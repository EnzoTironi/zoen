import { describe, expect, it } from "@effect/vitest";
import { executeSemanticViaActionRunner } from "@zoen/actions/host-execute";
import { createMemoryActionLog } from "@zoen/actions/log-memory";
import { sessionHostActor } from "@zoen/actions/session-actor";
import type { SemanticRequest } from "@zoen/contracts/worlds/operations";
import {
  SemanticRequest as SemanticRequestSchema,
  WorldCreated,
} from "@zoen/contracts/worlds/operations";
import { Effect, Schema } from "effect";

import { runToolCall } from "../src/tools/dispatch.ts";

const operationId = "11111111-1111-4111-8111-111111111111";
const worldId = "33333333-3333-4333-8333-333333333333";
const receiptRef = "44444444-4444-4444-8444-444444444444";

const worldCreated = Schema.decodeSync(WorldCreated)({
  _tag: "WorldCreated",
  receiptRef,
  worldRef: { realm: "live", worldId },
});

const createPersonalWorld = Schema.decodeSync(SemanticRequestSchema)({
  input: {},
  operation: "CreatePersonalWorld",
  operationId,
  purpose: "personal-records",
  schemaVersion: "worlds.v1",
});

describe("MCP W3 ActionRunner path", () => {
  it("proves Action Log entry on CreatePersonalWorld", () => {
    const log = createMemoryActionLog();
    let engineHits = 0;
    return executeSemanticViaActionRunner({
      actor: sessionHostActor(true),
      engine: {
        execute: (request) => {
          engineHits += 1;
          expect(request.operation).toBe("CreatePersonalWorld");
          return Promise.resolve(worldCreated);
        },
      },
      log,
      request: createPersonalWorld,
      // oxlint-disable-next-line effecttsgo/async-function -- Promise ActionLog.list union awaits in then-callback.
    }).then(async (outcome) => {
      expect(outcome.via).toBe("action-runner");
      expect(engineHits).toBe(1);
      expect(outcome.logEntry?.outcome).toBe("committed");
      expect(outcome.logEntry?.actionTypeId).toBe("worlds.CreatePersonalWorld");
      const entries = await Promise.resolve(log.list());
      expect(entries.map((e) => e.outcome).toSorted()).toStrictEqual([
        "accepted",
        "committed",
      ]);
    });
  });

  it("still dispatches CreatePersonalWorld tool text via mocked executor", () => {
    const run = (_request: SemanticRequest) => Effect.succeed(worldCreated);
    const result = Effect.runSync(
      runToolCall("CreatePersonalWorld", { operationId }, run)
    );
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.text)).toStrictEqual(worldCreated);
  });
});
