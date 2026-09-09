import { randomUUID } from "node:crypto";

import { defaultOmsRegistry } from "@zoen/oms/packs/default-registry";
import { describe, expect, it } from "vitest";

import type { ActionActor } from "../src/criteria.js";
import { isEmptySubmissionCriteria } from "../src/criteria.js";
import { InvalidActionParametersError } from "../src/invalid-action-parameters-error.js";
import { createMemoryActionLog } from "../src/log-memory.js";
import type { ActionEngine } from "../src/runner.js";
import { createActionRunner } from "../src/runner.js";
import { SubmissionCriteriaRejectedError } from "../src/submission-criteria-rejected-error.js";
import { UnknownActionTypeError } from "../src/unknown-action-type-error.js";

const authenticatedOwner: ActionActor = {
  authenticated: true,
  isOwner: true,
  principalId: randomUUID(),
  worldScope: true,
};

const unauthenticated: ActionActor = {
  authenticated: false,
  isOwner: false,
  principalId: null,
  worldScope: false,
};

const stubEngine = (result: unknown): ActionEngine => ({
  execute: (request) => Promise.resolve(result ?? request),
});

describe("W2 ActionRunner", () => {
  it("rejects unknown ActionType ids (fail closed)", async () => {
    const log = createMemoryActionLog();
    const runner = createActionRunner({
      actor: authenticatedOwner,
      engine: stubEngine({ _tag: "Unused" }),
      log,
      registry: defaultOmsRegistry,
    });

    await expect(
      runner.run({
        actionTypeId: "worlds.DoesNotExist",
        parameters: { purpose: "personal-records" },
      })
    ).rejects.toBeInstanceOf(UnknownActionTypeError);

    const entries = await log.list();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.outcome).toBe("rejected");
    expect(entries[0]?.rejectionCode).toBe("UnknownActionTypeError");
  });

  it("rejects missing required parameters", async () => {
    const log = createMemoryActionLog();
    const runner = createActionRunner({
      actor: authenticatedOwner,
      engine: stubEngine({ _tag: "Unused" }),
      log,
      registry: defaultOmsRegistry,
    });

    await expect(
      runner.run({
        actionTypeId: "worlds.CreatePersonalWorld",
        parameters: { purpose: "personal-records" },
      })
    ).rejects.toBeInstanceOf(InvalidActionParametersError);

    const entries = await log.list();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.outcome).toBe("rejected");
    expect(entries[0]?.rejectionCode).toBe("InvalidActionParametersError");
  });

  it("rejects unexpected parameters", async () => {
    const log = createMemoryActionLog();
    const runner = createActionRunner({
      actor: authenticatedOwner,
      engine: stubEngine({ _tag: "Unused" }),
      log,
      registry: defaultOmsRegistry,
    });

    await expect(
      runner.run({
        actionTypeId: "worlds.CreatePersonalWorld",
        parameters: {
          extra: true,
          operationId: randomUUID(),
          purpose: "personal-records",
        },
      })
    ).rejects.toBeInstanceOf(InvalidActionParametersError);
  });

  it("fail-closes when submission criteria unmet", async () => {
    const log = createMemoryActionLog();
    const runner = createActionRunner({
      actor: unauthenticated,
      engine: stubEngine({ _tag: "Unused" }),
      log,
      registry: defaultOmsRegistry,
    });

    await expect(
      runner.run({
        actionTypeId: "worlds.CreatePersonalWorld",
        parameters: {
          operationId: randomUUID(),
          purpose: "personal-records",
        },
      })
    ).rejects.toBeInstanceOf(SubmissionCriteriaRejectedError);

    const entries = await log.list();
    expect(entries[0]?.rejectionCode).toBe("SubmissionCriteriaRejectedError");
  });

  it("treats empty submission criteria as pass-through", () => {
    expect(
      isEmptySubmissionCriteria({
        notes: "none",
        requireAuthenticated: false,
        requireOwner: false,
        requireWorldScope: false,
      })
    ).toBeTruthy();
    expect(
      isEmptySubmissionCriteria({
        notes: "auth",
        requireAuthenticated: true,
        requireOwner: false,
        requireWorldScope: false,
      })
    ).toBeFalsy();
  });

  it("CreatePersonalWorld happy path records Action Log", async () => {
    const log = createMemoryActionLog();
    const receiptRef = randomUUID();
    const worldId = randomUUID();
    const operationId = randomUUID();
    const engineResult = {
      _tag: "WorldCreated",
      receiptRef,
      worldRef: { realm: "live", worldId },
    };
    let executed: unknown;
    const runner = createActionRunner({
      actor: authenticatedOwner,
      engine: {
        execute: (request) => {
          executed = request;
          return Promise.resolve(engineResult);
        },
      },
      log,
      registry: defaultOmsRegistry,
    });

    const success = await runner.run({
      actionTypeId: "worlds.CreatePersonalWorld",
      parameters: {
        operationId,
        purpose: "personal-records",
      },
    });

    expect(executed).toStrictEqual({
      input: {},
      operation: "CreatePersonalWorld",
      operationId,
      purpose: "personal-records",
      schemaVersion: "worlds.v1",
    });
    expect(success.result).toStrictEqual(engineResult);
    expect(success.logEntry.outcome).toBe("committed");
    expect(success.logEntry.receiptRef).toBe(receiptRef);
    expect(success.logEntry.actionTypeId).toBe("worlds.CreatePersonalWorld");
  });

  it("CreatePersonalWorld log carries actor and operationId", async () => {
    const log = createMemoryActionLog();
    const operationId = randomUUID();
    const runner = createActionRunner({
      actor: authenticatedOwner,
      engine: {
        execute: () =>
          Promise.resolve({
            _tag: "WorldCreated",
            receiptRef: randomUUID(),
            worldRef: { realm: "live", worldId: randomUUID() },
          }),
      },
      log,
      registry: defaultOmsRegistry,
    });

    const success = await runner.run({
      actionTypeId: "worlds.CreatePersonalWorld",
      parameters: { operationId, purpose: "personal-records" },
    });

    expect(success.logEntry.operationId).toBe(operationId);
    expect(success.logEntry.actorPrincipalId).toBe(
      authenticatedOwner.principalId
    );
    expect(success.logEntry.semanticOperation).toBe("CreatePersonalWorld");
    const entries = await log.list();
    expect(entries).toHaveLength(1);
  });

  it("wires Worlds pack ActionTypes and still rejects unknown", async () => {
    const log = createMemoryActionLog();
    const runner = createActionRunner({
      actor: authenticatedOwner,
      engine: stubEngine({ _tag: "Ok" }),
      log,
      registry: defaultOmsRegistry,
    });

    const actionIds = [...defaultOmsRegistry.actionTypes.keys()].toSorted();
    expect(actionIds).toContain("worlds.CreatePersonalWorld");
    expect(actionIds.length).toBeGreaterThanOrEqual(13);

    await expect(
      runner.run({ actionTypeId: "eve.Chat", parameters: {} })
    ).rejects.toBeInstanceOf(UnknownActionTypeError);
  });
});
