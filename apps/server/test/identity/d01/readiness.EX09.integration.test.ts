import { expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { D01Auth } from "../../../src/identity/d01/identity.ts";
import { makeTestIdentityLayer, withD01IdentityDatabase } from "./database.ts";

const roleName = SqlClient.SqlClient.pipe(
  Effect.flatMap((sql) => sql`SELECT current_user AS name`),
  Effect.flatMap(
    Schema.decodeUnknownEffect(
      Schema.Tuple([Schema.Struct({ name: Schema.String })])
    )
  ),
  Effect.map(([row]) => row.name)
);

it.live(
  "EX09 identity startup rejects isolated USAGE with no required table grants",
  () =>
    withD01IdentityDatabase((fixture) =>
      Effect.gen(function* insufficientStartupGrants() {
        const role = yield* roleName.pipe(
          Effect.provide(fixture.database.identity)
        );
        yield* SqlClient.SqlClient.pipe(
          Effect.flatMap(
            (sql) =>
              sql`REVOKE ALL ON ALL TABLES IN SCHEMA identity FROM ${sql(role)}`
          ),
          Effect.provide(fixture.database.migration)
        );
        const startup = yield* Effect.void.pipe(
          Effect.provide(
            makeTestIdentityLayer(fixture.config, fixture.database)
          ),
          Effect.result
        );
        expect(startup).toMatchObject({
          _tag: "Failure",
          failure: { _tag: "Unavailable", code: "UNAVAILABLE" },
        });
      })
    )
);

it.live(
  "EX09 readiness rechecks every required identity table privilege after startup",
  () =>
    withD01IdentityDatabase((fixture) =>
      Effect.gen(function* revokedGrants() {
        const auth = yield* D01Auth;
        yield* auth.checkHealth;
        const role = yield* roleName.pipe(
          Effect.provide(fixture.database.identity)
        );
        const failures = [];
        for (const table of [
          "user",
          "session",
          "account",
          "verification",
          "rateLimit",
        ]) {
          for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
            yield* SqlClient.SqlClient.pipe(
              Effect.flatMap(
                (sql) =>
                  sql`${sql.unsafe(`REVOKE ${privilege}`)} ON identity.${sql(table)} FROM ${sql(role)}`
              ),
              Effect.provide(fixture.database.migration)
            );
            const result = yield* auth.checkHealth.pipe(Effect.result);
            failures.push(result);
            yield* SqlClient.SqlClient.pipe(
              Effect.flatMap(
                (sql) =>
                  sql`${sql.unsafe(`GRANT ${privilege}`)} ON identity.${sql(table)} TO ${sql(role)}`
              ),
              Effect.provide(fixture.database.migration)
            );
            yield* auth.checkHealth;
          }
        }
        expect(failures).toHaveLength(20);
        for (const failure of failures) {
          expect(failure).toMatchObject({
            _tag: "Failure",
            failure: { _tag: "Unavailable", code: "UNAVAILABLE" },
          });
        }
      }).pipe(Effect.provide(fixture.runtime))
    )
);
