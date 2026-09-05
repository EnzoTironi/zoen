import { randomUUID } from "node:crypto";

import { PgClient } from "@effect/sql-pg";
import { expect, it } from "@effect/vitest";
import { Config, Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

const RuntimeIdentity = Schema.Tuple([
  Schema.Struct({
    create_database: Schema.Boolean,
    create_role: Schema.Boolean,
    create_schema: Schema.Boolean,
    name: Schema.NonEmptyString,
    superuser: Schema.Boolean,
  }),
]);

it.live(
  "PostgreSQL runtime commits, rolls back observed writes and cannot run DDL",
  () =>
    Effect.gen(function* postgresProbe() {
      const url = yield* Config.redacted("ZOEN_TEST_DATABASE_URL");
      const runtimeUrl = yield* Config.redacted(
        "ZOEN_TEST_RUNTIME_DATABASE_URL"
      );
      const namespace = `ex01_${randomUUID().replaceAll("-", "")}`;

      yield* Effect.gen(function* withInfrastructure() {
        const admin = yield* SqlClient.SqlClient;
        yield* Effect.acquireUseRelease(
          admin`CREATE SCHEMA ${admin(namespace)}`,
          () =>
            Effect.gen(function* prepareTable() {
              yield* admin`
              CREATE TABLE ${admin(namespace)}.probe_entries (
                id uuid PRIMARY KEY,
                payload text NOT NULL
              )
            `;
              yield* Effect.gen(function* checkRuntime() {
                const sql = yield* SqlClient.SqlClient;
                const [identity] = yield* sql`
    SELECT current_user AS name, rolsuper AS superuser,
           rolcreaterole AS create_role, rolcreatedb AS create_database,
           has_database_privilege(current_user, current_database(), 'CREATE') AS create_schema
    FROM pg_roles WHERE rolname = current_user
  `.pipe(Effect.flatMap(Schema.decodeUnknownEffect(RuntimeIdentity)));
                expect(identity).toMatchObject({
                  create_database: false,
                  create_role: false,
                  create_schema: false,
                  superuser: false,
                });

                yield* admin`GRANT USAGE ON SCHEMA ${admin(namespace)} TO ${admin(identity.name)}`;
                yield* admin`GRANT SELECT, INSERT ON ${admin(namespace)}.probe_entries TO ${admin(identity.name)}`;

                const committed = randomUUID();
                const rolledBack = randomUUID();
                yield* sql.withTransaction(
                  sql`INSERT INTO ${sql(namespace)}.probe_entries (id, payload)
        VALUES (${committed}, ${"committed control"})`
                );

                const failure = yield* sql
                  .withTransaction(
                    Effect.gen(function* rollbackObservedWrite() {
                      yield* sql`INSERT INTO ${sql(namespace)}.probe_entries (id, payload)
                  VALUES (${rolledBack}, ${"must roll back"})`;
                      const visibleInside = yield* sql`
          SELECT payload FROM ${sql(namespace)}.probe_entries WHERE id = ${rolledBack}
        `;
                      expect(visibleInside).toStrictEqual([
                        { payload: "must roll back" },
                      ]);
                      return yield* Effect.fail("requested-probe-rollback");
                    })
                  )
                  .pipe(Effect.flip);

                expect(failure).toBe("requested-probe-rollback");
                const afterRollback = yield* sql`
    SELECT id, payload FROM ${sql(namespace)}.probe_entries
  `;
                expect(afterRollback).toStrictEqual([
                  { id: committed, payload: "committed control" },
                ]);

                const denied = yield* sql
                  .withTransaction(
                    Effect.gen(function* rejectRuntimeDdl() {
                      yield* sql`CREATE TABLE ${sql(namespace)}.forbidden (id uuid)`;
                      return yield* Effect.fail(
                        "runtime-unexpectedly-had-ddl-rights"
                      );
                    })
                  )
                  .pipe(Effect.flip);
                expect(denied).toMatchObject({
                  _tag: "SqlError",
                  reason: { _tag: "AuthorizationError" },
                });
              }).pipe(
                Effect.provide(
                  PgClient.layer({
                    applicationName: "zoen-ex01-runtime-probe",
                    connectTimeout: "3 seconds",
                    maxConnections: 2,
                    url: runtimeUrl,
                  })
                )
              );
            }),
          () =>
            Effect.gen(function* removeNamespace() {
              yield* admin`DROP TABLE IF EXISTS ${admin(namespace)}.probe_entries`;
              yield* admin`DROP SCHEMA ${admin(namespace)}`;
            })
        );
      }).pipe(
        Effect.provide(
          PgClient.layer({
            applicationName: "zoen-ex01-infrastructure-probe",
            connectTimeout: "3 seconds",
            maxConnections: 2,
            url,
          })
        )
      );
    })
);
