import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { readCut } from "@zoen/authority/commit/guards";
import { WorldRef } from "@zoen/contracts/worlds/values";
import { Effect, FileSystem, Layer, Path, Redacted, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withD01Database } from "../../../../apps/server/test/adapters/postgres/worlds/database.ts";
import { seedEvidence } from "../../../../apps/server/test/adapters/postgres/worlds/seed.ts";
import {
  applyDisclosureMigrations,
  applyIdentityBasisMigrations,
} from "../../../../ops/migrations/run.ts";

const migrationServices = (
  database: Parameters<Parameters<typeof withD01Database>[0]>[0]
) => Layer.mergeAll(database.migration, NodeServices.layer);

const snapshot = Effect.gen(function* snapshotHistory() {
  const sql = yield* SqlClient.SqlClient;
  const rows: Record<string, unknown> = {};
  for (const table of [
    "authority.worlds",
    "authority.domains",
    "authority.evidence",
    "authority.receipts",
  ] as const) {
    rows[table] = yield* sql.unsafe(
      `SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text), '[]'::jsonb) AS rows FROM ${table} r`
    );
  }
  rows.migrations =
    yield* sql`SELECT migration_id FROM public.effect_sql_migrations WHERE migration_id = 7`;
  rows.domainCheck =
    yield* sql`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname = 'domains_domain_key_check'`;
  return rows;
});

it.live(
  "independent: SIGKILL during open 007 transaction rolls back; migrator recovers Unavailable cut",
  () =>
    withD01Database(
      (database) =>
        Effect.gen(function* refutePartialMigration() {
          const sql = yield* SqlClient.SqlClient;
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const seed = yield* seedEvidence();
          for (const domain of [
            "cases",
            "evidence",
            "membership",
            "sources",
          ] as const) {
            yield* sql`INSERT INTO authority.domains (world_id, realm, domain_key, version)
              VALUES (${seed.worldId}, ${seed.realm}, ${domain}, 0)
              ON CONFLICT DO NOTHING`;
          }
          const beforeDomains = yield* sql`
            SELECT domain_key FROM authority.domains
            WHERE world_id = ${seed.worldId}::uuid
            ORDER BY domain_key`;
          expect(beforeDomains.map((row) => row.domain_key)).toStrictEqual([
            "cases",
            "claims",
            "evidence",
            "membership",
            "sources",
          ]);
          const before = yield* snapshot;

          const directory = yield* fs.makeTempDirectoryScoped({
            prefix: "zoen-ex26-mig-",
          });
          const readyPath = path.join(directory, "ready");
          const identitySqlPath = fileURLToPath(
            new URL(
              "../../../../ops/migrations/007_subject_identity_domain.sql",
              import.meta.url
            )
          );
          const holdScript = fileURLToPath(
            new URL("migration-hold.ts", import.meta.url)
          );
          const logs: string[] = [];
          const child = yield* Effect.acquireRelease(
            Effect.sync(() => {
              const processChild = spawn(
                process.execPath,
                ["--experimental-strip-types", holdScript],
                {
                  cwd: fileURLToPath(new URL("../../../../", import.meta.url)),
                  env: {
                    ...process.env,
                    ZOEN_REVIEW_MIGRATION_SQL: identitySqlPath,
                    ZOEN_REVIEW_MIGRATION_URL: Redacted.value(
                      database.urls.migration
                    ),
                    ZOEN_REVIEW_READY_FILE: readyPath,
                  },
                  stdio: ["ignore", "pipe", "pipe"],
                }
              );
              processChild.stdout?.on("data", (chunk: Buffer) => {
                logs.push(chunk.toString("utf-8"));
              });
              processChild.stderr?.on("data", (chunk: Buffer) => {
                logs.push(chunk.toString("utf-8"));
              });
              return processChild;
            }),
            (processChild) =>
              Effect.sync(() => {
                if (!processChild.killed) {
                  processChild.kill("SIGKILL");
                }
              })
          );

          yield* Effect.gen(function* awaitReady() {
            for (let attempt = 0; attempt < 240; attempt += 1) {
              if (child.exitCode !== null) {
                return yield* Effect.die(
                  new Error(
                    `migration hold exited early code=${String(child.exitCode)} logs=${logs.join("")}`
                  )
                );
              }
              if (yield* fs.exists(readyPath)) {
                return null;
              }
              yield* Effect.sleep("100 millis");
            }
            return yield* Effect.die(
              new Error(`migration hold ready timeout logs=${logs.join("")}`)
            );
          });

          // DDL is visible inside the open transaction to the child, but uncommitted
          // to other sessions. Parent snapshot must still match the five-domain baseline.
          expect(yield* snapshot).toStrictEqual(before);

          child.kill("SIGKILL");
          yield* Effect.tryPromise(
            () =>
              new Promise<void>((resolve) => {
                if (child.exitCode !== null) {
                  resolve();
                  return;
                }
                child.once("exit", () => {
                  resolve();
                });
                setTimeout(() => {
                  resolve();
                }, 2000);
              })
          );
          expect(yield* snapshot).toStrictEqual(before);
          expect(
            yield* sql`SELECT migration_id FROM public.effect_sql_migrations WHERE migration_id = 7`
          ).toStrictEqual([]);

          // Incomplete activation (CHECK widened, identity row absent) stays Unavailable.
          yield* sql.unsafe(`
            ALTER TABLE authority.domains
              DROP CONSTRAINT domains_domain_key_check,
              ADD CONSTRAINT domains_domain_key_check
                CHECK (domain_key IN ('membership', 'sources', 'evidence', 'claims', 'cases', 'identity'));
          `);
          const worldRef = yield* Schema.decodeEffect(WorldRef)({
            realm: seed.realm,
            worldId: seed.worldId,
          });
          expect(yield* readCut(worldRef).pipe(Effect.flip)).toMatchObject({
            _tag: "Unavailable",
          });
          expect(
            yield* sql`SELECT count(*)::int AS worlds FROM authority.worlds WHERE world_id = ${seed.worldId}::uuid`
          ).toStrictEqual([{ worlds: 1 }]);
          expect(
            yield* sql`SELECT count(*)::int AS evidence FROM authority.evidence WHERE world_id = ${seed.worldId}::uuid`
          ).toStrictEqual([{ evidence: 1 }]);

          const applied = yield* applyIdentityBasisMigrations(
            database.names
          ).pipe(Effect.provide(migrationServices(database)));
          expect(applied).toStrictEqual(
            expect.arrayContaining([[7, "subject_identity_domain"]])
          );
          expect(yield* readCut(worldRef)).toMatchObject({ identity: "0" });
          expect(
            yield* sql`
              SELECT domain_key, version::text AS version
              FROM authority.domains
              WHERE world_id = ${seed.worldId}::uuid
              ORDER BY domain_key`
          ).toStrictEqual([
            { domain_key: "cases", version: "0" },
            { domain_key: "claims", version: "0" },
            { domain_key: "evidence", version: "0" },
            { domain_key: "identity", version: "0" },
            { domain_key: "membership", version: "0" },
            { domain_key: "sources", version: "0" },
          ]);
          return {
            oracles: ["sigkill-007-rollback", "unavailable-then-recover"],
            worldId: seed.worldId,
          };
        }).pipe(
          Effect.provide(Layer.mergeAll(database.migration, NodeServices.layer))
        ),
      undefined,
      (database) =>
        applyDisclosureMigrations(database.names).pipe(
          Effect.provide(migrationServices(database))
        )
    ),
  180_000
);
