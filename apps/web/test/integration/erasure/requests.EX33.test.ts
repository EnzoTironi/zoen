import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { WorldErasureRequested } from "@zoen/contracts/erasure/operations";
import { WorldRef } from "@zoen/contracts/worlds/values";
import { Effect, Schema } from "effect";

import {
  emptyErasure,
  erasurePatch,
} from "../../../src/features/erasure/model.ts";
import {
  confirmWorldErasureRequest,
  inspectWorldErasureRequest,
} from "../../../src/features/erasure/requests.ts";

const world = Schema.decodeSync(WorldRef)({
  realm: "live",
  worldId: randomUUID(),
});

it.effect(
  "EX33 inspect request omits operationId by default and binds schema",
  () =>
    Effect.gen(function* inspectShape() {
      const inspect = yield* inspectWorldErasureRequest(world);
      expect(inspect.operation).toBe("InspectWorldErasure");
      expect(inspect.schemaVersion).toBe("erasure.v1");
      expect(inspect.input.operationId).toBeNull();
      expect("operationId" in inspect).toBeFalsy();
    })
);

it.effect(
  "EX33 confirm request requires entire-world true and fresh operationId",
  () =>
    Effect.gen(function* confirmShape() {
      const first = yield* confirmWorldErasureRequest(world, null);
      const second = yield* confirmWorldErasureRequest(world, null);
      expect(first.operation).toBe("RequestWorldErasure");
      expect(first.input.confirmEntireWorld).toBeTruthy();
      expect(first.input.expectedErasureRevision).toBeNull();
      expect(first.input.policyVersion).toBe("d03-local-erasable-v1");
      expect(first.operationId).not.toBe(second.operationId);
    })
);

it.effect(
  "EX33 erasurePatch keeps Closing receipt without promoting Erased",
  () =>
    Effect.sync(() => {
      const receipt = Schema.decodeSync(WorldErasureRequested)({
        _tag: "WorldErasureRequested",
        attemptExternalState: "Confirmed",
        phase: "Closing",
        policyVersion: "d03-local-erasable-v1",
        receiptRef: randomUUID(),
        restoreAfterErasure: false,
        revision: "1",
        worldRef: world,
      });
      const patch = erasurePatch(receipt);
      expect(patch.receipt?.phase).toBe("Closing");
      expect(patch.progress?.phase).toBe("Closing");
      expect(patch.progress?.restoreAfterErasure).toBeFalsy();
      expect(patch.confirmation).toBeFalsy();
      expect({ ...emptyErasure, ...patch }.receipt?.phase).not.toBe("Erased");
    })
);
