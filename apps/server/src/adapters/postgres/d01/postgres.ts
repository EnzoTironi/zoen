import { PgClient } from "@effect/sql-pg";
import { Effect, Layer, type Redacted, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

export interface D01PostgresConfig {
  readonly url: Redacted.Redacted;
  readonly applicationName: string;
  readonly maxConnections: number;
}

export class UnsafePostgresRole extends Schema.TaggedError<UnsafePostgresRole>()(
  "UnsafePostgresRole",
  { code: Schema.Literal("runtime_role_is_privileged") }
) {}

const AllowedRole = Schema.Tuple([
  Schema.Struct({ allowed: Schema.Literal(true) }),
]);

const runtimeRoleCheck = Layer.effectDiscard(
  Effect.gen(function* checkD01DatabaseRole() {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`
    SELECT NOT (
      rolsuper OR rolcreaterole OR rolcreatedb OR rolbypassrls
      OR has_database_privilege(current_user, current_database(), 'CREATE')
      OR has_database_privilege(current_user, current_database(), 'TEMPORARY')
      OR has_schema_privilege(current_user, 'authority', 'CREATE')
      OR has_schema_privilege(current_user, 'identity', 'CREATE')
      OR has_schema_privilege(current_user, 'jobs', 'CREATE')
    ) AS allowed
    FROM pg_roles WHERE rolname = current_user
  `.pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(AllowedRole)),
      Effect.catchTag(
        "SchemaError",
        () => new UnsafePostgresRole({ code: "runtime_role_is_privileged" })
      )
    );
  })
);

/** A concrete pool profile, not another SQL/transaction abstraction. */
export const makeD01PostgresLayer = (config: D01PostgresConfig) =>
  runtimeRoleCheck.pipe(
    Layer.provideMerge(
      PgClient.layer({
        applicationName: config.applicationName,
        connectTimeout: "3 seconds",
        idleTimeout: "30 seconds",
        maxConnections: config.maxConnections,
        url: config.url,
      })
    )
  );
