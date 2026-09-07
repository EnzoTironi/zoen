import { expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { checkWorldsRuntimeRole } from "../../../../src/adapters/postgres/worlds/postgres.ts";
import { withWorldsDatabase } from "./database.ts";

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

for (const mode of ["direct", "indirect", "admin-option"] as const) {
  it.live(`Worlds rejects ${mode} SET ROLE access to the migration owner`, () =>
    withWorldsDatabase((database) =>
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
          yield* checkWorldsRuntimeRole;
          if (mode === "indirect") {
            yield* admin`GRANT ${admin(migration)} TO ${admin(progress)}`;
            yield* admin`GRANT ${admin(progress)} TO ${admin(runtime)}`;
          } else if (mode === "admin-option") {
            yield* admin`GRANT ${admin(migration)} TO ${admin(runtime)} WITH ADMIN TRUE, INHERIT FALSE, SET FALSE`;
            expect(
              yield* sql`SELECT pg_has_role(current_user, ${migration}, 'SET') AS allowed`
            ).toStrictEqual([{ allowed: false }]);
          } else {
            yield* admin`GRANT ${admin(migration)} TO ${admin(runtime)}`;
          }
          expect(yield* checkWorldsRuntimeRole.pipe(Effect.flip)).toMatchObject(
            {
              _tag: "UnsafePostgresRole",
            }
          );
          if (mode === "admin-option") {
            yield* sql`GRANT ${sql(migration)} TO ${sql(runtime)} WITH SET TRUE`;
          }
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
