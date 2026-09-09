import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  ACTION_LOG_TABLE,
  actionLogInsertSql,
  createPgActionLog,
} from "../src/log-pg.js";

describe("W2 createPgActionLog", () => {
  it("exposes durable table + INSERT and implements ActionLog append/list", async () => {
    expect(ACTION_LOG_TABLE).toBe("authority.action_log");
    expect(actionLogInsertSql).toContain("INSERT INTO authority.action_log");

    const stored: unknown[][] = [];
    const rows: Record<string, unknown>[] = [];
    const log = createPgActionLog({
      execute: async (_statement, params) => {
        stored.push([...params]);
        rows.push({
          actionTypeId: params[1],
          actorPrincipalId: params[2],
          attemptedAt: params[11],
          completedAt: params[12],
          entryId: params[0],
          operationId: params[3],
          outcome: params[7],
          realm: params[6],
          receiptRef: params[9],
          rejectionCode: params[8],
          result: params[10] === null ? null : JSON.parse(String(params[10])),
          semanticOperation: params[4],
          worldId: params[5],
        });
      },
      query: async () => rows,
    });

    const operationId = randomUUID();
    const entry = await log.append({
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

    expect(entry.operationId).toBe(operationId);
    expect(stored).toHaveLength(1);
    const listed = await log.list();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.outcome).toBe("committed");
    expect(listed[0]?.result).toStrictEqual({ ok: true });
  });
});
