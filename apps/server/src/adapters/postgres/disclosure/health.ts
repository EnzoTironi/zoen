import { PgClient } from "@effect/sql-pg";
import { Unavailable } from "@zoen/contracts/worlds/errors";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";
import type { Pool } from "pg";

import { checkD01RuntimeRole } from "../worlds/postgres.ts";

/** Readiness verifies the actual coordinator role, schema and required grants. */
export const checkDisclosurePool = (pool: Pool) =>
  Effect.gen(function* disclosureRole() {
    yield* checkD01RuntimeRole;
    const sql = yield* SqlClient.SqlClient;
    yield* sql`SELECT has_schema_privilege(current_user, 'jobs', 'USAGE')
    AND NOT EXISTS (
      SELECT FROM (VALUES
        ('jobs.disclosure_subjects', 'SELECT'), ('jobs.disclosure_subjects', 'INSERT'),
        ('jobs.disclosure_pending', 'SELECT'), ('jobs.disclosure_pending', 'INSERT'), ('jobs.disclosure_pending', 'DELETE'),
        ('jobs.disclosure_session_closing', 'SELECT'), ('jobs.disclosure_session_closing', 'INSERT')
      ) AS required(relation, privilege)
      WHERE NOT coalesce(has_table_privilege(current_user, to_regclass(required.relation), required.privilege), false)
    )
    AND coalesce(has_column_privilege(current_user, to_regclass('jobs.disclosure_subjects'), 'revision', 'UPDATE'), false)
    AS allowed`.pipe(
      Effect.flatMap(
        Schema.decodeUnknownEffect(
          Schema.Tuple([Schema.Struct({ allowed: Schema.Literal(true) })])
        )
      )
    );
  }).pipe(
    Effect.provide(
      PgClient.layerFrom(PgClient.fromPool({ acquire: Effect.succeed(pool) }))
    ),
    Effect.timeout("3 seconds"),
    Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
  );
