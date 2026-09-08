import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

export class UnsafeEveJournalRole extends Schema.TaggedError<UnsafeEveJournalRole>()(
  "UnsafeEveJournalRole",
  { code: Schema.Literal("runtime_role_is_privileged") }
) {}

const AllowedRole = Schema.Tuple([
  Schema.Struct({ allowed: Schema.Literal(true) }),
]);

/**
 * Journal runtime must be a restricted role: no superuser/bypass, no CREATE on
 * eve/authority/identity/jobs/public, and no table privileges outside eve.
 */
export const checkEveJournalRuntimeRole = Effect.gen(
  function* checkEveJournalDatabaseRole() {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`
    SELECT NOT EXISTS (
      SELECT FROM pg_roles
      WHERE (rolname = current_user OR pg_has_role(current_user, oid, 'SET'))
      AND (
        rolsuper OR rolcreaterole OR rolcreatedb OR rolbypassrls OR rolreplication
        OR EXISTS (
          SELECT FROM pg_auth_members
          WHERE member = pg_roles.oid AND admin_option
        )
        OR has_database_privilege(oid, current_database(), 'CREATE')
        OR has_database_privilege(oid, current_database(), 'TEMPORARY')
        OR (
          EXISTS (SELECT FROM pg_namespace WHERE nspname = 'eve')
          AND has_schema_privilege(oid, 'eve', 'CREATE')
        )
        OR has_schema_privilege(oid, 'authority', 'CREATE')
        OR has_schema_privilege(oid, 'identity', 'CREATE')
        OR has_schema_privilege(oid, 'jobs', 'CREATE')
        OR has_schema_privilege(oid, 'public', 'CREATE')
        OR has_schema_privilege(oid, 'authority', 'USAGE')
        OR has_schema_privilege(oid, 'identity', 'USAGE')
        OR has_schema_privilege(oid, 'jobs', 'USAGE')
        OR EXISTS (
          SELECT FROM information_schema.role_table_grants g
          WHERE g.grantee = pg_roles.rolname
            AND g.table_schema <> 'eve'
            AND g.privilege_type IN (
              'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE',
              'REFERENCES', 'TRIGGER'
            )
        )
      )
    ) AS allowed
  `.pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(AllowedRole)),
      Effect.catchTag(
        "SchemaError",
        () => new UnsafeEveJournalRole({ code: "runtime_role_is_privileged" })
      )
    );
  }
);
