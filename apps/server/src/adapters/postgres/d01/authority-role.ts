import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { checkD01RuntimeRole } from "./postgres.ts";

export class IncompleteAuthorityRole extends Schema.TaggedError<IncompleteAuthorityRole>()(
  "IncompleteAuthorityRole",
  { code: Schema.Literal("authority_role_is_incomplete") }
) {}

/** Positive capabilities are required in addition to the generic excess-privilege guard. */
export const checkD01AuthorityRole = Effect.gen(function* authorityRole() {
  yield* checkD01RuntimeRole;
  const sql = yield* SqlClient.SqlClient;
  yield* sql`
    SELECT has_schema_privilege(current_user, 'authority', 'USAGE')
      AND has_schema_privilege(current_user, 'jobs', 'USAGE')
      AND NOT EXISTS (
        SELECT FROM pg_roles
        WHERE (rolname = current_user OR pg_has_role(current_user, oid, 'SET'))
          AND has_schema_privilege(oid, 'identity', 'USAGE')
      )
      AND NOT EXISTS (
        SELECT FROM (VALUES
          ('authority.worlds'), ('authority.memberships'), ('authority.domains'),
          ('authority.receipts'), ('authority.bootstrap_operations'), ('authority.operations'),
          ('authority.sources'), ('authority.evidence'), ('authority.claims'),
          ('authority.frames'), ('authority.pins'), ('authority.cases'), ('authority.corrections'),
          ('jobs.captures'), ('jobs.outbox')
        ) AS required(table_name)
        CROSS JOIN (VALUES ('SELECT'), ('INSERT')) AS permission(privilege)
        WHERE NOT has_table_privilege(current_user, table_name, privilege)
      )
      AND NOT EXISTS (
        SELECT FROM (VALUES ('authority.worlds'), ('authority.memberships'), ('authority.domains')) AS required(table_name)
        WHERE NOT has_table_privilege(current_user, table_name, 'UPDATE')
      )
      AND NOT EXISTS (
        SELECT FROM (VALUES
          ('authority.sources', 'label'), ('authority.evidence', 'state'), ('authority.cases', 'state'),
          ('jobs.captures', 'state'), ('jobs.captures', 'object_location'), ('jobs.captures', 'fence')
        ) AS required(table_name, column_name)
        WHERE NOT has_column_privilege(current_user, table_name, column_name, 'UPDATE')
      ) AS allowed
  `.pipe(
    Effect.flatMap(
      Schema.decodeUnknownEffect(
        Schema.Tuple([Schema.Struct({ allowed: Schema.Literal(true) })])
      )
    ),
    Effect.catchTag(
      "SchemaError",
      () =>
        new IncompleteAuthorityRole({ code: "authority_role_is_incomplete" })
    )
  );
});
