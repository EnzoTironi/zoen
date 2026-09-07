import { PgClient } from "@effect/sql-pg";
import type {
  PrincipalId,
  SessionId,
} from "@zoen/authority/ports/worlds/context";
import { Unavailable } from "@zoen/contracts/worlds/errors";
import { Effect, Redacted, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { Pool } from "pg";

import { checkWorldsRuntimeRole } from "../../adapters/postgres/worlds/postgres.ts";

/** Check only the authenticated provider session, using its own identity pool. */
export const identitySessionExists = (
  pool: Pool,
  sessionId: typeof SessionId.Type
) =>
  SqlClient.SqlClient.use(
    (sql) =>
      sql`SELECT EXISTS (SELECT 1 FROM identity.session WHERE id = ${sessionId}) AS present`
  ).pipe(
    Effect.flatMap(
      Schema.decodeUnknownEffect(
        Schema.Tuple([Schema.Struct({ present: Schema.Boolean })])
      )
    ),
    Effect.map(([row]) => row.present),
    Effect.provide(
      PgClient.layerFrom(PgClient.fromPool({ acquire: Effect.succeed(pool) }))
    ),
    Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
  );

/** Exact UUID lookup through the existing identity role and pool. */
export const identityPrincipalExists = (
  pool: Pool,
  principalId: typeof PrincipalId.Type
) =>
  SqlClient.SqlClient.use(
    (sql) =>
      sql`SELECT EXISTS (SELECT 1 FROM identity."user" WHERE id = ${principalId}) AS present`
  ).pipe(
    Effect.flatMap(
      Schema.decodeUnknownEffect(
        Schema.Tuple([Schema.Struct({ present: Schema.Boolean })])
      )
    ),
    Effect.map(([row]) => row.present),
    Effect.provide(
      PgClient.layerFrom(PgClient.fromPool({ acquire: Effect.succeed(pool) }))
    ),
    Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
  );

export const acquireIdentityPool = Effect.fn("identity.acquirePool")(
  function* acquirePool(url: Redacted.Redacted) {
    const runLog = Effect.runSyncWith(yield* Effect.context());
    return yield* Effect.acquireRelease(
      Effect.sync(() => {
        const pool = new Pool({
          application_name: "zoen-worlds-identity",
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
export const checkIdentityPool = Effect.fn("identity.checkPool")(
  function* checkPool(pool: Pool) {
    yield* Effect.gen(function* admission() {
      yield* checkWorldsRuntimeRole;
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
