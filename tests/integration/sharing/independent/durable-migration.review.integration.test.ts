import { randomUUID } from "node:crypto";

import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withWorldsDatabase } from "../../../../apps/server/test/adapters/postgres/worlds/database.ts";
import { seedEvidence } from "../../../../apps/server/test/adapters/postgres/worlds/seed.ts";
import {
  applyDisclosureMigrations,
  applySharingMigrations,
} from "../../../../ops/migrations/run.ts";

const oldSnapshot = Effect.gen(function* oldSnapshot() {
  const sql = yield* SqlClient.SqlClient;
  const tables = yield* sql<{
    schema: string;
    name: string;
  }>`SELECT n.nspname AS schema, c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname IN ('authority', 'identity', 'jobs') AND c.relkind = 'r' AND c.relname NOT LIKE 'disclosure_%' ORDER BY 1, 2`;
  const rows: Record<string, unknown> = {};
  for (const table of tables) {
    rows[`${table.schema}.${table.name}`] =
      yield* sql`SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text), '[]'::jsonb) AS rows FROM ${sql(table.schema)}.${sql(table.name)} r`;
  }
  const migrations =
    yield* sql`SELECT * FROM public.effect_sql_migrations WHERE migration_id <= 5 ORDER BY migration_id`;
  const tableRights =
    yield* sql`SELECT n.nspname, c.relname, c.relowner, c.relacl FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname IN ('authority', 'identity', 'jobs') AND c.relkind = 'r' AND c.relname NOT LIKE 'disclosure_%' ORDER BY 1, 2`;
  const columnRights =
    yield* sql`SELECT n.nspname, c.relname, a.attname, a.attacl FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname IN ('authority', 'identity', 'jobs') AND c.relkind = 'r' AND c.relname NOT LIKE 'disclosure_%' AND a.attnum > 0 AND NOT a.attisdropped ORDER BY 1, 2, 3`;
  const schemaRights =
    yield* sql`SELECT nspname, nspowner, nspacl FROM pg_namespace WHERE nspname IN ('authority', 'identity', 'jobs', 'public') ORDER BY nspname`;
  return { columnRights, migrations, rows, schemaRights, tableRights };
});

const coordinationSnapshot = SqlClient.SqlClient.use(
  (sql) =>
    sql`SELECT 'subjects' AS kind, to_jsonb(s) AS row FROM jobs.disclosure_subjects s UNION ALL SELECT 'pending', to_jsonb(p) FROM jobs.disclosure_pending p UNION ALL SELECT 'closing', to_jsonb(c) FROM jobs.disclosure_session_closing c ORDER BY kind, row`
);
const permissionDenied = {
  _tag: "SqlError",
  reason: { cause: { code: "42501" } },
};

it.live(
  "independent EX22 migration 006 preserves 001–005 data and privileges, grants only coordination rights, and is idempotent",
  () =>
    withWorldsDatabase(
      (database) =>
        Effect.gen(function* reviewMigration() {
          const sql = yield* SqlClient.SqlClient;
          const services = Layer.mergeAll(
            database.migration,
            NodeServices.layer
          );
          const seed = yield* seedEvidence();
          // Synthetic SQL history, not a fabricated provider response or authenticated admission.
          yield* sql`INSERT INTO identity."user" (id, name, email, "emailVerified") VALUES (${seed.principal}, 'Migration history', ${`${randomUUID()}@example.test`}, false)`;
          yield* sql`INSERT INTO identity."session" (id, "expiresAt", token, "updatedAt", "userId") VALUES (${randomUUID()}, '2026-09-06T00:00:00Z', ${randomUUID()}, '2026-09-05T00:00:00Z', ${seed.principal})`;
          yield* sql`INSERT INTO jobs.outbox (world_id, realm, outbox_id, receipt_id, state, fence, event_kind, payload_ref) VALUES (${seed.worldId}, ${seed.realm}, ${randomUUID()}, ${seed.receipt}, 'pending', 0, 'world-created', ${seed.receipt})`;
          const before = yield* oldSnapshot;
          expect(
            yield* sql`SELECT migration_id FROM public.effect_sql_migrations ORDER BY migration_id`
          ).toStrictEqual(
            [1, 2, 3, 4, 5].map((migration_id) => ({ migration_id }))
          );
          expect(
            yield* applyDisclosureMigrations(database.names).pipe(
              Effect.provide(services)
            )
          ).toStrictEqual([[6, "durable_disclosure"]]);
          expect(yield* oldSnapshot).toStrictEqual(before);

          const permit = randomUUID();
          yield* Effect.gen(function* authorityCoordination() {
            const authority = yield* SqlClient.SqlClient;
            yield* authority.withTransaction(
              Effect.gen(function* record() {
                for (const key of ["session-review", "membership-review"]) {
                  yield* authority`INSERT INTO jobs.disclosure_subjects (subject_key, revision) VALUES (${key}, 0) ON CONFLICT (subject_key) DO UPDATE SET revision = jobs.disclosure_subjects.revision + 1`;
                  yield* authority`INSERT INTO jobs.disclosure_subjects (subject_key, revision) VALUES (${key}, 0) ON CONFLICT (subject_key) DO UPDATE SET revision = jobs.disclosure_subjects.revision + 1`;
                }
                yield* authority`INSERT INTO jobs.disclosure_pending (permit_id, session_key, membership_key) VALUES (${permit}, 'session-review', 'membership-review')`;
              })
            );
            expect(
              yield* authority`SELECT revision::text FROM jobs.disclosure_subjects ORDER BY subject_key`
            ).toStrictEqual([{ revision: "1" }, { revision: "1" }]);
            expect(
              yield* authority`SELECT permit_id FROM jobs.disclosure_pending WHERE membership_key = 'membership-review'`
            ).toStrictEqual([{ permit_id: permit }]);
            yield* authority`INSERT INTO jobs.disclosure_session_closing (session_key) VALUES ('session-review') ON CONFLICT (session_key) DO NOTHING`;
            expect(
              yield* authority`SELECT session_key FROM jobs.disclosure_session_closing`
            ).toStrictEqual([{ session_key: "session-review" }]);
            for (const statement of [
              "DELETE FROM jobs.disclosure_subjects",
              "UPDATE jobs.disclosure_subjects SET subject_key = subject_key",
              "DELETE FROM jobs.disclosure_session_closing",
              "UPDATE jobs.disclosure_session_closing SET created_at = created_at",
              "UPDATE jobs.disclosure_pending SET membership_key = membership_key",
              "UPDATE jobs.disclosure_pending SET session_key = session_key",
              "UPDATE jobs.disclosure_pending SET permit_id = permit_id",
              "UPDATE jobs.disclosure_pending SET created_at = created_at",
            ]) {
              expect(
                yield* authority.unsafe(statement).pipe(Effect.flip)
              ).toMatchObject(permissionDenied);
            }
          }).pipe(Effect.provide(database.authority));

          for (const role of [database.identity, database.progress]) {
            yield* Effect.gen(function* deniedCoordination() {
              const client = yield* SqlClient.SqlClient;
              for (const table of [
                "disclosure_subjects",
                "disclosure_pending",
                "disclosure_session_closing",
              ]) {
                for (const operation of [
                  "SELECT * FROM",
                  "DELETE FROM",
                  "INSERT INTO",
                ]) {
                  const statement =
                    operation === "INSERT INTO"
                      ? `${operation} jobs.${table} DEFAULT VALUES`
                      : `${operation} jobs.${table}`;
                  expect(
                    yield* client.unsafe(statement).pipe(Effect.flip)
                  ).toMatchObject(permissionDenied);
                }
              }
            }).pipe(Effect.provide(role));
          }
          const recorded = yield* coordinationSnapshot;
          expect(recorded).toHaveLength(4);
          const metadata =
            yield* sql`SELECT * FROM public.effect_sql_migrations ORDER BY migration_id`;
          expect(
            yield* applyDisclosureMigrations(database.names).pipe(
              Effect.provide(services)
            )
          ).toStrictEqual([]);
          expect(yield* coordinationSnapshot).toStrictEqual(recorded);
          expect(yield* oldSnapshot).toStrictEqual(before);
          expect(
            yield* sql`SELECT * FROM public.effect_sql_migrations ORDER BY migration_id`
          ).toStrictEqual(metadata);
          yield* SqlClient.SqlClient.use(
            (authority) =>
              authority`DELETE FROM jobs.disclosure_pending WHERE permit_id = ${permit}`
          ).pipe(Effect.provide(database.authority));
          expect(
            yield* sql`SELECT permit_id FROM jobs.disclosure_pending`
          ).toStrictEqual([]);
          expect(
            yield* sql`SELECT count(*)::int AS n FROM jobs.disclosure_subjects`
          ).toStrictEqual([{ n: 2 }]);
          expect(
            yield* sql`SELECT count(*)::int AS n FROM jobs.disclosure_session_closing`
          ).toStrictEqual([{ n: 1 }]);
        }).pipe(Effect.provide(database.migration)),
      undefined,
      (database) =>
        applySharingMigrations(database.names).pipe(
          Effect.provide(Layer.mergeAll(database.migration, NodeServices.layer))
        )
    )
);
