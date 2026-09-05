import { expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { checkD01RuntimeRole } from "../../../../src/adapters/postgres/d01/postgres.ts";
import { withD01Database } from "./database.ts";

const roleName = Effect.gen(function* currentRole() {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql`SELECT current_user AS name`.pipe(
    Effect.flatMap(
      Schema.decodeUnknownEffect(
        Schema.Tuple([Schema.Struct({ name: Schema.NonEmptyString })])
      )
    )
  );
  return row.name;
});

for (const indirect of [false, true]) {
  it.live(
    `D01 rejects ${indirect ? "indirect" : "direct"} SET ROLE access to the migration owner`,
    () =>
      withD01Database((database) =>
        Effect.gen(function* membership() {
          const admin = yield* SqlClient.SqlClient;
          const migration = yield* roleName.pipe(
            Effect.provide(database.migration)
          );
          const progress = yield* roleName.pipe(
            Effect.provide(database.progress)
          );
          yield* Effect.gen(function* reachableOwner() {
            const sql = yield* SqlClient.SqlClient;
            const runtime = yield* roleName;
            yield* checkD01RuntimeRole;
            if (indirect) {
              yield* admin`GRANT ${admin(migration)} TO ${admin(progress)}`;
              yield* admin`GRANT ${admin(progress)} TO ${admin(runtime)}`;
            } else {
              yield* admin`GRANT ${admin(migration)} TO ${admin(runtime)}`;
            }
            expect(yield* checkD01RuntimeRole.pipe(Effect.flip)).toMatchObject({
              _tag: "UnsafePostgresRole",
            });
            // The dangerous grant is real: ignoring admission still permits actual DDL.
            const rollback = yield* sql
              .withTransaction(
                Effect.gen(function* demonstrateEscalation() {
                  yield* sql`SET LOCAL ROLE ${sql(migration)}`;
                  yield* sql`CREATE TABLE authority.set_role_witness (id uuid)`;
                  expect(yield* roleName).toBe(migration);
                  return yield* Effect.fail("rollback-escalation-witness");
                })
              )
              .pipe(Effect.flip);
            expect(rollback).toBe("rollback-escalation-witness");
          }).pipe(Effect.provide(database.authority));
        })
      )
  );
}
