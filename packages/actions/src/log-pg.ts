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

const toIsoTimestamp = (value: unknown): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    return value;
  }
  return String(value);
};

const mapRow = (row: Record<string, unknown>): ActionLogEntry => ({
  actionTypeId: String(row.actionTypeId),
  actorPrincipalId:
    row.actorPrincipalId === null || row.actorPrincipalId === undefined
      ? null
      : String(row.actorPrincipalId),
  attemptedAt: toIsoTimestamp(row.attemptedAt),
  completedAt: toIsoTimestamp(row.completedAt),
  entryId: String(row.entryId),
  operationId:
    row.operationId === null || row.operationId === undefined
      ? null
      : String(row.operationId),
  outcome: row.outcome as ActionLogEntry["outcome"],
  realm:
    row.realm === null || row.realm === undefined
      ? null
      : (row.realm as ActionLogEntry["realm"]),
  receiptRef:
    row.receiptRef === null || row.receiptRef === undefined
      ? null
      : String(row.receiptRef),
  rejectionCode:
    row.rejectionCode === null || row.rejectionCode === undefined
      ? null
      : String(row.rejectionCode),
  result: row.result === undefined ? null : row.result,
  semanticOperation: String(row.semanticOperation),
  worldId:
    row.worldId === null || row.worldId === undefined
      ? null
      : String(row.worldId),
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
      entry.result === null ? null : JSON.stringify(entry.result),
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
