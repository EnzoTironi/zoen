/**
 * Postgres Action Log append helpers (authority.action_log — migration 021).
 * Runtime composition wires SqlClient; this module documents the durable shape.
 * Unit tests use createMemoryActionLog; integration uses INSERT below.
 */

export const ACTION_LOG_TABLE = "authority.action_log" as const;

/** Parameterized INSERT for append-only Action Log rows. */
export const actionLogInsertSql = `
INSERT INTO authority.action_log (
  entry_id,
  action_type_id,
  actor_principal_id,
  operation_id,
  semantic_operation,
  world_id,
  realm,
  outcome,
  rejection_code,
  receipt_ref,
  result,
  attempted_at,
  completed_at
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::timestamptz, $13::timestamptz
)
` as const;
