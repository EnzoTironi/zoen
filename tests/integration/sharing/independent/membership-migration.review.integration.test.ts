import { randomUUID } from "node:crypto";

import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { Migrator, SqlClient } from "effect/unstable/sql";

import { withWorldsDatabase } from "../../../../apps/server/test/adapters/postgres/worlds/database.ts";
import type { WorldsTestDatabase } from "../../../../apps/server/test/adapters/postgres/worlds/database.ts";
import {
  claimRow,
  seedEvidence,
} from "../../../../apps/server/test/adapters/postgres/worlds/seed.ts";
import {
  applyApplicationMigrations,
  applySharingMigrations,
} from "../../../../ops/migrations/run.ts";

const migrationServices = (database: WorldsTestDatabase) =>
  Layer.mergeAll(database.migration, NodeServices.layer);
const installBaseline = (database: WorldsTestDatabase) =>
  applyApplicationMigrations(database.names).pipe(
    Effect.provide(migrationServices(database))
  );

// SQL fixture history, not authenticated application admission or a release transition.
const history = Effect.gen(function* history() {
  const sql = yield* SqlClient.SqlClient;
  const rows: Record<string, unknown> = {};
  for (const table of [
    "authority.worlds",
    "authority.memberships",
    "authority.domains",
    "authority.sources",
    "authority.evidence",
    "authority.claims",
    "authority.receipts",
    "authority.pins",
    "jobs.captures",
  ] as const) {
    rows[table] = yield* sql.unsafe(
      `SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text), '[]'::jsonb) AS rows FROM ${table} r`
    );
  }
  rows.migrations =
    yield* sql`SELECT * FROM public.effect_sql_migrations WHERE migration_id <= 4 ORDER BY migration_id`;
  rows.tableRights =
    yield* sql`SELECT n.nspname, c.relname, c.relowner, c.relacl FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname IN ('authority', 'identity', 'jobs') AND c.relkind = 'r' ORDER BY n.nspname, c.relname`;
  rows.columnRights =
    yield* sql`SELECT n.nspname, c.relname, a.attname, a.attacl FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname IN ('authority', 'identity', 'jobs') AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped ORDER BY n.nspname, c.relname, a.attname`;
  rows.schemaRights =
    yield* sql`SELECT nspname, nspowner, nspacl FROM pg_namespace WHERE nspname IN ('authority', 'identity', 'jobs', 'public') ORDER BY nspname`;
  return rows;
});
const roleFlags = (database: WorldsTestDatabase) =>
  SqlClient.SqlClient.use(
    (sql) =>
      sql`SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin, rolreplication, rolbypassrls FROM pg_roles WHERE rolname IN (${database.names.authority}, ${database.names.identity}, ${database.names.progress}, ${database.names.migration}) ORDER BY rolname`
  );
const membershipSchema = SqlClient.SqlClient.use(
  (sql) =>
    sql`SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid = 'authority.memberships'::regclass UNION ALL SELECT indexname AS conname, indexdef AS definition FROM pg_indexes WHERE schemaname = 'authority' AND tablename = 'memberships' ORDER BY conname, definition`
);

it.live(
  "independent SH-10 migration preserves baseline history and privileges while allowing viewers and one owner per World realm",
  () =>
    withWorldsDatabase(
      (database) =>
        Effect.gen(function* migrateValidHistory() {
          const sql = yield* SqlClient.SqlClient;
          const first = yield* seedEvidence();
          yield* seedEvidence(first.worldId, "evaluation");
          yield* sql`INSERT INTO authority.claims ${sql.insert(claimRow(first))}`;
          yield* sql`INSERT INTO authority.pins ${sql.insert({ created_at: "2026-09-05T00:00:00.000Z", evidence_id: first.evidence, owner_id: first.evidence, owner_kind: "evidence", realm: first.realm, world_id: first.worldId })}`;
          yield* sql`UPDATE authority.memberships SET state = 'revoked', revision = 7 WHERE world_id = ${first.worldId} AND realm = 'live'`;
          const before = yield* history;
          const flags = yield* roleFlags(database);
          expect(
            yield* sql`INSERT INTO authority.memberships (world_id, realm, principal_id, state, revision, role) VALUES (${first.worldId}, 'live', ${randomUUID()}, 'active', 0, 'viewer')`.pipe(
              Effect.flip
            )
          ).toMatchObject({
            _tag: "SqlError",
            reason: {
              cause: { code: "23514", constraint: "memberships_role_check" },
            },
          });
          expect(
            yield* applySharingMigrations(database.names).pipe(
              Effect.provide(migrationServices(database))
            )
          ).toStrictEqual([[5, "world_read_membership"]]);
          expect(yield* history).toStrictEqual(before);
          expect(yield* roleFlags(database)).toStrictEqual(flags);
          expect(
            yield* sql`SELECT role, state, revision::text FROM authority.memberships WHERE world_id = ${first.worldId} AND realm = 'live'`
          ).toStrictEqual([{ revision: "7", role: "owner", state: "revoked" }]);
          const viewer = randomUUID();
          yield* SqlClient.SqlClient.use(
            (authority) =>
              authority`INSERT INTO authority.memberships (world_id, realm, principal_id, state, revision, role) VALUES (${first.worldId}, 'live', ${viewer}, 'active', 0, 'viewer')`
          ).pipe(Effect.provide(database.authority));
          expect(
            yield* SqlClient.SqlClient.use(
              (authority) =>
                authority`SELECT role FROM authority.memberships WHERE world_id = ${first.worldId} AND realm = 'live' AND principal_id = ${viewer}`
            ).pipe(Effect.provide(database.authority))
          ).toStrictEqual([{ role: "viewer" }]);
          expect(
            yield* sql`INSERT INTO authority.memberships (world_id, realm, principal_id, state, revision, role) VALUES (${first.worldId}, 'live', ${randomUUID()}, 'active', 0, 'editor')`.pipe(
              Effect.flip
            )
          ).toMatchObject({
            _tag: "SqlError",
            reason: {
              cause: { code: "23514", constraint: "memberships_role_check" },
            },
          });
          expect(
            yield* sql`INSERT INTO authority.memberships (world_id, realm, principal_id, state, revision, role) VALUES (${first.worldId}, 'live', ${randomUUID()}, 'active', 0, 'owner')`.pipe(
              Effect.flip
            )
          ).toMatchObject({
            _tag: "SqlError",
            reason: {
              cause: { code: "23505", constraint: "memberships_one_owner" },
            },
          });
          expect(
            yield* SqlClient.SqlClient.use(
              (identity) =>
                identity`UPDATE authority.memberships SET state = 'revoked' WHERE principal_id = ${viewer}`
            ).pipe(Effect.provide(database.identity), Effect.flip)
          ).toMatchObject({
            _tag: "SqlError",
            reason: { cause: { code: "42501" } },
          });
          expect(
            yield* SqlClient.SqlClient.use(
              (authority) => authority`SELECT id FROM identity."user"`
            ).pipe(Effect.provide(database.authority), Effect.flip)
          ).toMatchObject({
            _tag: "SqlError",
            reason: { cause: { code: "42501" } },
          });
          const after = yield* history;
          const metadata =
            yield* sql`SELECT * FROM public.effect_sql_migrations ORDER BY migration_id`;
          const schema = yield* membershipSchema;
          expect(
            yield* applySharingMigrations(database.names).pipe(
              Effect.provide(migrationServices(database))
            )
          ).toStrictEqual([]);
          expect(
            yield* applyApplicationMigrations(database.names).pipe(
              Effect.provide(migrationServices(database))
            )
          ).toStrictEqual([]);
          expect(yield* history).toStrictEqual(after);
          expect(
            yield* sql`SELECT * FROM public.effect_sql_migrations ORDER BY migration_id`
          ).toStrictEqual(metadata);
          expect(yield* membershipSchema).toStrictEqual(schema);
        }).pipe(Effect.provide(database.migration)),
      undefined,
      installBaseline
    )
);

for (const owners of [0, 2]) {
  it.live(
    `independent SH-10 migration rejects ${owners} historical owners atomically without repairing history`,
    () =>
      withWorldsDatabase(
        (database) =>
          Effect.gen(function* rejectInvalidHistory() {
            const sql = yield* SqlClient.SqlClient;
            const seed = yield* seedEvidence();
            yield* owners === 0
              ? sql`DELETE FROM authority.memberships WHERE world_id = ${seed.worldId}`
              : sql`INSERT INTO authority.memberships (world_id, realm, principal_id, state, revision, role) VALUES (${seed.worldId}, 'live', ${randomUUID()}, 'revoked', 5, 'owner')`;
            const before = yield* history;
            const schema = yield* membershipSchema;
            const flags = yield* roleFlags(database);
            const failed = yield* applySharingMigrations(database.names).pipe(
              Effect.provide(migrationServices(database)),
              Effect.catchDefect((defect) =>
                defect instanceof Migrator.MigrationError
                  ? Effect.fail(defect)
                  : Effect.die(defect)
              ),
              Effect.flip
            );
            expect(failed).toMatchObject({
              _tag: "MigrationError",
              cause: {
                _tag: "SqlError",
                reason: {
                  cause: {
                    code: "23514",
                    constraint: "world_requires_one_owner",
                  },
                },
              },
            });
            expect(yield* history).toStrictEqual(before);
            expect(yield* membershipSchema).toStrictEqual(schema);
            expect(yield* roleFlags(database)).toStrictEqual(flags);
            expect(
              yield* sql`SELECT migration_id FROM public.effect_sql_migrations WHERE migration_id = 5`
            ).toStrictEqual([]);
            expect(
              yield* sql`SELECT count(*)::int AS owners FROM authority.memberships WHERE world_id = ${seed.worldId} AND role = 'owner'`
            ).toStrictEqual([{ owners }]);
            expect(
              yield* sql`INSERT INTO authority.memberships (world_id, realm, principal_id, state, revision, role) VALUES (${seed.worldId}, 'live', ${randomUUID()}, 'active', 0, 'viewer')`.pipe(
                Effect.flip
              )
            ).toMatchObject({
              _tag: "SqlError",
              reason: {
                cause: { code: "23514", constraint: "memberships_role_check" },
              },
            });
          }).pipe(Effect.provide(database.migration)),
        undefined,
        installBaseline
      )
  );
}

it.live(
  "independent SH-10 limit: the unique index does not preserve an owner against direct privileged SQL",
  () =>
    withWorldsDatabase(
      (database) =>
        Effect.gen(function* ownerExistenceLimit() {
          const sql = yield* SqlClient.SqlClient;
          const seed = yield* seedEvidence();
          yield* applySharingMigrations(database.names).pipe(
            Effect.provide(migrationServices(database))
          );
          // This is an administrative counterexample, never a product sharing operation.
          yield* sql`UPDATE authority.memberships SET role = 'viewer' WHERE world_id = ${seed.worldId} AND realm = 'live' AND principal_id = ${seed.principal}`;
          expect(
            yield* sql`SELECT role FROM authority.memberships WHERE world_id = ${seed.worldId} AND realm = 'live'`
          ).toStrictEqual([{ role: "viewer" }]);
          expect(
            yield* sql`SELECT count(*)::int AS owners FROM authority.memberships WHERE world_id = ${seed.worldId} AND realm = 'live' AND role = 'owner'`
          ).toStrictEqual([{ owners: 0 }]);
          // Replay is migration idempotency, not continuous validation or repair of administrator mutations.
          expect(
            yield* applySharingMigrations(database.names).pipe(
              Effect.provide(migrationServices(database))
            )
          ).toStrictEqual([]);
          expect(
            yield* sql`SELECT count(*)::int AS owners FROM authority.memberships WHERE world_id = ${seed.worldId} AND realm = 'live' AND role = 'owner'`
          ).toStrictEqual([{ owners: 0 }]);
        }).pipe(Effect.provide(database.migration)),
      undefined,
      installBaseline
    )
);
