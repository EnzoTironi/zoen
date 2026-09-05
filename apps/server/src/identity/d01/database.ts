import { PgClient } from "@effect/sql-pg";
import { Unavailable } from "@zoen/contracts/d01/errors";
import { Effect, Redacted, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { Pool } from "pg";

import { checkD01RuntimeRole } from "../../adapters/postgres/d01/postgres.ts";

export const acquireD01IdentityPool = Effect.fn("identity.acquirePool")(
  function* acquirePool(url: Redacted.Redacted) {
    const runLog = Effect.runSyncWith(yield* Effect.context());
    return yield* Effect.acquireRelease(
      Effect.sync(() => {
        const pool = new Pool({
          application_name: "zoen-d01-identity",
          connectionString: Redacted.value(url),
          connectionTimeoutMillis: 3000,
          idleTimeoutMillis: 30_000,
          max: 4,
          options: "-c search_path=identity",
        });
        pool.on("error", () => {
          runLog(Effect.logError("Identity database connection failed"));
        });
        return pool;
      }),
      (pool) =>
        Effect.tryPromise({
          catch: () => new Unavailable({ code: "UNAVAILABLE" }),
          try: () => pool.end(),
        }).pipe(Effect.orDie)
    );
  }
);

/** Uses the very same pool Better Auth will use, without giving it domain grants. */
export const checkD01IdentityPool = Effect.fn("identity.checkPool")(
  function* checkPool(pool: Pool) {
    yield* Effect.gen(function* admission() {
      yield* checkD01RuntimeRole;
      const sql = yield* SqlClient.SqlClient;
      yield* sql`SELECT current_schema() = 'identity'
      AND has_schema_privilege(current_user, 'identity', 'USAGE')
      AND NOT EXISTS (
        SELECT FROM (VALUES
          ('identity."user"'), ('identity."session"'), ('identity."account"'),
          ('identity."verification"'), ('identity."rateLimit"')
        ) AS required(relation)
        CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) AS permission(privilege)
        WHERE NOT coalesce(has_table_privilege(current_user, to_regclass(required.relation), permission.privilege), false)
      )
      AND NOT EXISTS (
        SELECT FROM pg_roles
        WHERE (rolname = current_user OR pg_has_role(current_user, oid, 'SET'))
          AND (has_schema_privilege(oid, 'authority', 'USAGE')
            OR has_schema_privilege(oid, 'jobs', 'USAGE'))
      ) AS allowed`.pipe(
        Effect.flatMap(
          Schema.decodeUnknownEffect(
            Schema.Tuple([Schema.Struct({ allowed: Schema.Literal(true) })])
          )
        ),
        Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
      );
    }).pipe(
      Effect.provide(
        PgClient.layerFrom(PgClient.fromPool({ acquire: Effect.succeed(pool) }))
      ),
      Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
    );
  }
);
