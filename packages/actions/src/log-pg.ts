import { randomUUID } from "node:crypto";

import type { ActionLog, ActionLogAppendInput, ActionLogEntry } from "./log.js";

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

export const actionLogListSql = `
SELECT
  entry_id AS "entryId",
  action_type_id AS "actionTypeId",
  actor_principal_id AS "actorPrincipalId",
  operation_id AS "operationId",
  semantic_operation AS "semanticOperation",
  world_id AS "worldId",
  realm,
  outcome,
  rejection_code AS "rejectionCode",
  receipt_ref AS "receiptRef",
  result,
  attempted_at AS "attemptedAt",
  completed_at AS "completedAt"
FROM authority.action_log
ORDER BY attempted_at ASC, entry_id ASC
` as const;

/**
 * Minimal SQL driver for the durable Action Log (migration 021).
 * Hosts wire Effect SqlClient / pg behind these two callables.
 */
export interface ActionLogSqlDriver {
  readonly execute: (
    statement: string,
    params: readonly unknown[]
  ) => Promise<void>;
  readonly query: (
    statement: string,
    params?: readonly unknown[]
  ) => Promise<readonly Record<string, unknown>[]>;
}

const asString = (value: unknown, field: string): string => {
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  throw new TypeError(`action_log.${field} must be a string`);
};

const asNullableString = (value: unknown, field: string): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  return asString(value, field);
};

const asOutcome = (value: unknown): ActionLogEntry["outcome"] => {
  if (
    value === "accepted" ||
    value === "committed" ||
    value === "failed" ||
    value === "rejected"
  ) {
    return value;
  }
  throw new TypeError(
    "action_log.outcome must be accepted|committed|failed|rejected"
  );
};

const asRealm = (value: unknown): ActionLogEntry["realm"] => {
  if (value === null || value === undefined) {
    return null;
  }
  if (value === "live" || value === "evaluation") {
    return value;
  }
  throw new TypeError("action_log.realm must be live|evaluation|null");
};

const mapRow = (row: Record<string, unknown>): ActionLogEntry => ({
  actionTypeId: asString(row.actionTypeId, "actionTypeId"),
  actorPrincipalId: asNullableString(row.actorPrincipalId, "actorPrincipalId"),
  attemptedAt: asString(row.attemptedAt, "attemptedAt"),
  completedAt: asString(row.completedAt, "completedAt"),
  entryId: asString(row.entryId, "entryId"),
  operationId: asNullableString(row.operationId, "operationId"),
  outcome: asOutcome(row.outcome),
  realm: asRealm(row.realm),
  receiptRef: asNullableString(row.receiptRef, "receiptRef"),
  rejectionCode: asNullableString(row.rejectionCode, "rejectionCode"),
  result: row.result === undefined ? null : row.result,
  semanticOperation: asString(row.semanticOperation, "semanticOperation"),
  worldId: asNullableString(row.worldId, "worldId"),
});

/** Postgres ActionLog port over authority.action_log (append + list). */
export const createPgActionLog = (driver: ActionLogSqlDriver): ActionLog => ({
  append: async (input: ActionLogAppendInput): Promise<ActionLogEntry> => {
    const entryId = randomUUID();
    const entry: ActionLogEntry = {
      actionTypeId: input.actionTypeId,
      actorPrincipalId: input.actorPrincipalId,
      attemptedAt: input.attemptedAt,
      completedAt: input.completedAt,
      entryId,
      operationId: input.operationId,
      outcome: input.outcome,
      realm: input.realm,
      receiptRef: input.receiptRef,
      rejectionCode: input.rejectionCode,
      result: input.result,
      semanticOperation: input.semanticOperation,
      worldId: input.worldId,
    };
    const resultJson =
      entry.result === null ? null : JSON.stringify(entry.result);
    await driver.execute(actionLogInsertSql, [
      entry.entryId,
      entry.actionTypeId,
      entry.actorPrincipalId,
      entry.operationId,
      entry.semanticOperation,
      entry.worldId,
      entry.realm,
      entry.outcome,
      entry.rejectionCode,
      entry.receiptRef,
      resultJson,
      entry.attemptedAt,
      entry.completedAt,
    ]);
    return entry;
  },
  list: async (): Promise<readonly ActionLogEntry[]> => {
    const rows = await driver.query(actionLogListSql);
    return rows.map(mapRow);
  },
});
