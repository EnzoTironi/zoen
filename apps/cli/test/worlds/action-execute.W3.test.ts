import { executeSemanticViaActionRunner } from "@zoen/actions/host-execute";
import { createMemoryActionLog } from "@zoen/actions/log-memory";
import { sessionHostActor } from "@zoen/actions/session-actor";
import { SemanticRequest as SemanticRequestSchema } from "@zoen/contracts/worlds/operations";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

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

describe("CLI W3 ActionRunner Worlds transport", () => {
  it("proves Action Log entry on CreatePersonalWorld", () => {
    const log = createMemoryActionLog();
    return executeSemanticViaActionRunner({
      actor: sessionHostActor(true),
      engine: {
        execute: (request) => {
          expect(request).toMatchObject({
            operation: "CreatePersonalWorld",
            operationId,
          });
          return Promise.resolve({
            _tag: "WorldCreated",
            receiptRef,
            worldRef: { realm: "live", worldId },
          });
        },
      },
      log,
      request: createPersonalWorld,
    }).then((outcome) => {
      expect(outcome.via).toBe("action-runner");
      expect(outcome.logEntry?.semanticOperation).toBe("CreatePersonalWorld");
      expect(outcome.logEntry?.outcome).toBe("committed");
    });
  });
});
