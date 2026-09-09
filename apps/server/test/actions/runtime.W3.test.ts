import { createMemoryActionLog } from "@zoen/actions/log-memory";
import { createActionRunner } from "@zoen/actions/runner";
import { sessionHostActor } from "@zoen/actions/session-actor";
import { defaultOmsRegistry } from "@zoen/oms/packs/default-registry";
import { describe, expect, it } from "vitest";

/**
 * Composition wires makeActionRuntimeLayer (PG Action Log). This unit proves
 * the same ActionRunner factory shape the server layer exposes.
 */
describe("server W3 ActionRuntime shape", () => {
  it("CreatePersonalWorld commits through ActionRunner with log", () => {
    const log = createMemoryActionLog();
    const runner = createActionRunner({
      actor: sessionHostActor(true),
      engine: {
        execute: () =>
          Promise.resolve({
            _tag: "WorldCreated",
            receiptRef: "44444444-4444-4444-8444-444444444444",
            worldRef: {
              realm: "live",
              worldId: "33333333-3333-4333-8333-333333333333",
            },
          }),
      },
      log,
      registry: defaultOmsRegistry,
    });
    return (
      runner
        .run({
          actionTypeId: "worlds.CreatePersonalWorld",
          parameters: {
            operationId: "11111111-1111-4111-8111-111111111111",
            purpose: "personal-records",
          },
        })
        // oxlint-disable-next-line effecttsgo/async-function -- Promise ActionLog.list union awaits in then-callback.
        .then(async (success) => {
          expect(success.logEntry.outcome).toBe("committed");
          const entries = await Promise.resolve(log.list());
          expect(entries.length).toBeGreaterThanOrEqual(2);
        })
    );
  });
});
