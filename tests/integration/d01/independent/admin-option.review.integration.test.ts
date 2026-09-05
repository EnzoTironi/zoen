import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { checkD01RuntimeRole } from "../../../../apps/server/src/adapters/postgres/d01/postgres.js";
import { withD01Database } from "../../../../apps/server/test/adapters/postgres/d01/database.js";

describe("independent ADMIN OPTION membership review", () => {
  it.live("rejects ADMIN OPTION that can restore migration SET access", () =>
    withD01Database((database) =>
      Effect.gen(function* roleMembership() {
        const admin = yield* SqlClient.SqlClient;
        const migration = yield* SqlClient.SqlClient.use(
          (sql) => sql`SELECT current_user::text AS name`
        ).pipe(Effect.provide(database.migration));
        yield* Effect.gen(function* runtimeMembership() {
          const runtime = yield* SqlClient.SqlClient;
          const authority = yield* runtime`SELECT current_user::text AS name`;
          yield* admin`GRANT ${admin(String(migration[0]?.name))} TO ${admin(String(authority[0]?.name))} WITH ADMIN TRUE, INHERIT FALSE, SET FALSE`;
          const checked = yield* Effect.result(checkD01RuntimeRole);
          expect(
            yield* runtime`SELECT pg_has_role(current_user, ${String(migration[0]?.name)}, 'SET') AS allowed`
          ).toStrictEqual([{ allowed: false }]);
          yield* runtime`GRANT ${runtime(String(migration[0]?.name))} TO ${runtime(String(authority[0]?.name))} WITH SET TRUE`;
          const escalated = yield* runtime.withTransaction(
            Effect.gen(function* escalateRole() {
              yield* runtime`SET LOCAL ROLE ${runtime(String(migration[0]?.name))}`;
              yield* runtime`CREATE TABLE authority.independent_role_witness (id integer)`;
              return yield* runtime`SELECT current_user::text AS name`;
            })
          );
          expect(escalated).toStrictEqual(migration);
          expect(checked).toMatchObject({
            _tag: "Failure",
            failure: { _tag: "UnsafePostgresRole" },
          });
        }).pipe(Effect.provide(database.authority));
      })
    )
  );
});
