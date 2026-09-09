import { randomUUID } from "node:crypto";

import type { SemanticRequest } from "@zoen/contracts/worlds/operations";
import { SemanticRequest as SemanticRequestSchema } from "@zoen/contracts/worlds/operations";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { executeSemanticViaActionRunner } from "../src/host-execute.js";
import { createMemoryActionLog } from "../src/log-memory.js";
import { tryMapWorldsAction } from "../src/map-request.js";
import type { ActionEngine } from "../src/runner.js";
import { sessionHostActor } from "../src/session-actor.js";
import { isWorldsPackOperation } from "../src/worlds-ops.js";

const operationId = "11111111-1111-4111-8111-111111111111";
const worldId = "33333333-3333-4333-8333-333333333333";
const receiptRef = "44444444-4444-4444-8444-444444444444";

const createPersonalWorld = Schema.decodeSync(SemanticRequestSchema)({
  input: {},
  operation: "CreatePersonalWorld",
  operationId,
  purpose: "personal-records",
  schemaVersion: "worlds.v1",
});

const inspectSubjectIdentity = Schema.decodeSync(SemanticRequestSchema)({
  input: {
    anchors: ["A", "B"],
    atFrame: null,
    interval: { _tag: "DateInterval", from: "2026-09-01", to: "2026-10-01" },
  },
  operation: "InspectSubjectIdentity",
  purpose: "personal-records",
  schemaVersion: "subject-identity.v1",
  worldRef: { realm: "live", worldId },
});

describe("W3 host ActionRunner path", () => {
  it("maps CreatePersonalWorld onto worlds.CreatePersonalWorld", () => {
    const mapped = tryMapWorldsAction(createPersonalWorld);
    expect(mapped).toStrictEqual({
      actionTypeId: "worlds.CreatePersonalWorld",
      parameters: {
        operationId,
        purpose: "personal-records",
      },
    });
    expect(isWorldsPackOperation("CreatePersonalWorld")).toBeTruthy();
    expect(isWorldsPackOperation("InspectSubjectIdentity")).toBeFalsy();
  });

  it("leaves subject-identity on the direct-engine escape hatch", () => {
    const log = createMemoryActionLog();
    const seen: SemanticRequest[] = [];
    const engine: ActionEngine = {
      execute: (request) => {
        seen.push(request);
        return Promise.resolve({ _tag: "SubjectIdentityInspected" });
      },
    };
    return executeSemanticViaActionRunner({
      actor: sessionHostActor(true),
      engine,
      log,
      request: inspectSubjectIdentity,
    }).then(async (outcome) => {
      expect(outcome.via).toBe("direct-engine");
      expect(outcome.logEntry).toBeNull();
      expect(seen).toHaveLength(1);
      await expect(Promise.resolve(log.list())).resolves.toHaveLength(0);
    });
  });

  it("proves Action Log entry on CreatePersonalWorld via ActionRunner", () => {
    const log = createMemoryActionLog();
    const engine: ActionEngine = {
      execute: (request) => {
        expect(request.operation).toBe("CreatePersonalWorld");
        return Promise.resolve({
          _tag: "WorldCreated",
          receiptRef,
          worldRef: { realm: "live", worldId },
        });
      },
    };
    return executeSemanticViaActionRunner({
      actor: sessionHostActor(true, randomUUID()),
      engine,
      log,
      request: createPersonalWorld,
    }).then(async (outcome) => {
      expect(outcome.via).toBe("action-runner");
      expect(outcome.logEntry?.outcome).toBe("committed");
      expect(outcome.logEntry?.actionTypeId).toBe("worlds.CreatePersonalWorld");
      expect(outcome.logEntry?.semanticOperation).toBe("CreatePersonalWorld");
      const entries = await Promise.resolve(log.list());
      expect(entries.some((e) => e.outcome === "accepted")).toBeTruthy();
      expect(entries.some((e) => e.outcome === "committed")).toBeTruthy();
    });
  });
});
