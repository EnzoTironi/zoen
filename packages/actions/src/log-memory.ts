import { randomUUID } from "node:crypto";

import type { ActionLog, ActionLogAppendInput, ActionLogEntry } from "./log.js";

/** In-memory append-only Action Log for unit tests and local runners. */
export const createMemoryActionLog = (): ActionLog => {
  const entries: ActionLogEntry[] = [];
  return {
    append: (input: ActionLogAppendInput): ActionLogEntry => {
      const entry: ActionLogEntry = {
        actionTypeId: input.actionTypeId,
        actorPrincipalId: input.actorPrincipalId,
        attemptedAt: input.attemptedAt,
        completedAt: input.completedAt,
        entryId: randomUUID(),
        operationId: input.operationId,
        outcome: input.outcome,
        realm: input.realm,
        receiptRef: input.receiptRef,
        rejectionCode: input.rejectionCode,
        result: input.result,
        semanticOperation: input.semanticOperation,
        worldId: input.worldId,
      };
      entries.push(entry);
      return entry;
    },
    list: (): readonly ActionLogEntry[] => [...entries],
  };
};
