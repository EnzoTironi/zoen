import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  ACTION_LOG_TABLE,
  actionLogInsertSql,
  createPgActionLog,
} from "../src/log-pg.js";

describe("W2 createPgActionLog", () => {
  it("implements ActionLog append/list over the durable SQL shape", async () => {
    expect(ACTION_LOG_TABLE).toBe("authority.action_log");
    expect(actionLogInsertSql).toContain("INSERT INTO authority.action_log");

    const rows: Record<string, unknown>[] = [];
    const log = createPgActionLog({
      execute: (_statement, params) => {
        const [
          entryId,
          actionTypeId,
          actorPrincipalId,
          operationId,
          semanticOperation,
          worldId,
          realm,
          outcome,
          rejectionCode,
          receiptRef,
          resultJson,
          attemptedAt,
          completedAt,
        ] = params;
        rows.push({
          actionTypeId,
          actorPrincipalId,
          attemptedAt,
          completedAt,
          entryId,
          operationId,
          outcome,
          realm,
          receiptRef,
          rejectionCode,
          result:
            typeof resultJson === "string" ? JSON.parse(resultJson) : null,
          semanticOperation,
          worldId,
        });
        return Promise.resolve();
      },
      query: () => Promise.resolve(rows),
    });

    const operationId = randomUUID();
    await log.append({
      actionTypeId: "worlds.CreatePersonalWorld",
      actorPrincipalId: randomUUID(),
      attemptedAt: "2026-09-09T22:00:00.000Z",
      completedAt: "2026-09-09T22:00:01.000Z",
      operationId,
      outcome: "committed",
      realm: "live",
      receiptRef: randomUUID(),
      rejectionCode: null,
      result: { ok: true },
      semanticOperation: "CreatePersonalWorld",
      worldId: randomUUID(),
    });

    const listed = await log.list();
    expect(listed).toStrictEqual([
      expect.objectContaining({
        operationId,
        outcome: "committed",
        result: { ok: true },
      }),
    ]);
  });
});
