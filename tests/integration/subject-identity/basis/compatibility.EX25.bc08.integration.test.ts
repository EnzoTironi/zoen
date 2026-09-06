import { fileURLToPath } from "node:url";

import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { readCut } from "@zoen/authority/commit/guards";
import { WorldRef } from "@zoen/contracts/d01/values";
import { Effect, FileSystem, Layer, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withD01Database } from "../../../../apps/server/test/adapters/postgres/d01/database.ts";
import { seedEvidence } from "../../../../apps/server/test/adapters/postgres/d01/seed.ts";
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
    "authority.memberships",
    "authority.domains",
    "authority.sources",
    "authority.evidence",
    "authority.receipts",
    "authority.pins",
    "jobs.captures",
  ] as const) {
    rows[table] = yield* sql.unsafe(
      `SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text), '[]'::jsonb) AS rows FROM ${table} r`
    );
  }
  rows.migrations =
    yield* sql`SELECT migration_id, name FROM public.effect_sql_migrations ORDER BY migration_id`;
  rows.domainCheck =
    yield* sql`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname = 'domains_domain_key_check'`;
  return rows;
});

it.live(
  "EX25 BC-08 failed identity-basis migration rolls back and incomplete activation stays Unavailable",
  () =>
    withD01Database(
      (database) =>
        Effect.gen(function* proveMigrationFailure() {
          const sql = yield* SqlClient.SqlClient;
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
            SELECT domain_key
            FROM authority.domains
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

          const identitySql = yield* FileSystem.FileSystem.use((fs) =>
            fs.readFileString(
              fileURLToPath(
                new URL(
                  "../../../../ops/migrations/007_subject_identity_domain.sql",
                  import.meta.url
                )
              )
            )
          ).pipe(Effect.provide(NodeServices.layer));

          const failed = yield* sql
            .withTransaction(
              Effect.gen(function* injectFailure() {
                yield* sql.unsafe(identitySql);
                return yield* Effect.fail(
                  "injected-identity-migration-failure"
                );
              })
            )
            .pipe(Effect.flip);
          expect(failed).toBe("injected-identity-migration-failure");
          expect(yield* snapshot).toStrictEqual(before);
          expect(
            yield* sql`SELECT migration_id FROM public.effect_sql_migrations WHERE migration_id = 7`
          ).toStrictEqual([]);

          // Partial activation: CHECK admits identity but the domain row is absent.
          yield* sql.unsafe(`
            ALTER TABLE authority.domains
              DROP CONSTRAINT domains_domain_key_check,
              ADD CONSTRAINT domains_domain_key_check
                CHECK (domain_key IN ('membership', 'sources', 'evidence', 'claims', 'cases', 'identity'));
          `);
          expect(
            yield* sql`
              SELECT domain_key FROM authority.domains
              WHERE world_id = ${seed.worldId}::uuid AND domain_key = 'identity'`
          ).toStrictEqual([]);
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
          expect(
            yield* sql`SELECT receipt_id::text AS receipt_id FROM authority.receipts WHERE world_id = ${seed.worldId}::uuid`
          ).toStrictEqual([{ receipt_id: seed.receipt }]);

          // Recovery through the approved migrator completes the additive domain.
          const applied = yield* applyIdentityBasisMigrations(
            database.names
          ).pipe(Effect.provide(migrationServices(database)));
          expect(applied).toStrictEqual(
            expect.arrayContaining([[7, "subject_identity_domain"]])
          );
          expect(yield* readCut(worldRef)).toMatchObject({
            identity: "0",
          });
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
          return { bc: ["BC-08"], worldId: seed.worldId };
        }).pipe(Effect.provide(database.migration)),
      undefined,
      (database) =>
        applyDisclosureMigrations(database.names).pipe(
          Effect.provide(migrationServices(database))
        )
    ),
  120_000
);
