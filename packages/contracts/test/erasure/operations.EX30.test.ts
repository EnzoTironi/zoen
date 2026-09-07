import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

import {
  InspectWorldErasure,
  RequestWorldErasure,
  WorldErasureInspected,
  WorldErasureRequested,
} from "../../src/erasure/operations.js";
import {
  ErasurePolicyProfileId,
  ErasureRestoreAfterErasure,
} from "../../src/erasure/values.js";

const worldRef = {
  realm: "live" as const,
  worldId: "00000000-0000-4000-8000-000000000001",
};
const operationId = "00000000-0000-4000-8000-000000000002";

describe("EX30 erasure schemas", () => {
  it("encodes RequestWorldErasure with entire-world confirmation", () => {
    const request = Schema.decodeUnknownSync(RequestWorldErasure)({
      input: {
        confirmEntireWorld: true,
        expectedErasureRevision: null,
        policyVersion: "d03-local-erasable-v1",
      },
      operation: "RequestWorldErasure",
      operationId,
      purpose: "personal-records",
      schemaVersion: "erasure.v1",
      worldRef,
    });
    expect(request.input.confirmEntireWorld).toBeTruthy();
    expect(request.schemaVersion).toBe("erasure.v1");
  });

  it("keeps restoreAfterErasure literally false on success DTOs", () => {
    expect(
      Schema.decodeUnknownSync(ErasureRestoreAfterErasure)(false)
    ).toBeFalsy();
    expect(() =>
      Schema.decodeUnknownSync(ErasureRestoreAfterErasure)(true)
    ).toThrow(/./u);
    const inspected = Schema.decodeUnknownSync(WorldErasureInspected)({
      _tag: "WorldErasureInspected",
      attemptExternalState: "Registered",
      phase: "Closing",
      restoreAfterErasure: false,
      revision: "1",
      worldRef,
    });
    expect(inspected.restoreAfterErasure).toBeFalsy();
    const requested = Schema.decodeUnknownSync(WorldErasureRequested)({
      _tag: "WorldErasureRequested",
      attemptExternalState: "Registered",
      phase: "Closing",
      policyVersion: "d03-local-erasable-v1",
      receiptRef: "00000000-0000-4000-8000-000000000003",
      restoreAfterErasure: false,
      revision: "1",
      worldRef,
    });
    expect(requested.restoreAfterErasure).toBeFalsy();
  });

  it("freezes candidate profile id for new Worlds only", () => {
    expect(
      Schema.decodeUnknownSync(ErasurePolicyProfileId)("d03-local-erasable-v1")
    ).toBe("d03-local-erasable-v1");
    expect(() =>
      Schema.decodeUnknownSync(ErasurePolicyProfileId)(
        "worlds-local-retained-v1"
      )
    ).toThrow(/./u);
  });

  it("accepts InspectWorldErasure", () => {
    const inspect = Schema.decodeUnknownSync(InspectWorldErasure)({
      input: { operationId: null },
      operation: "InspectWorldErasure",
      purpose: "personal-records",
      schemaVersion: "erasure.v1",
      worldRef,
    });
    expect(inspect.operation).toBe("InspectWorldErasure");
  });
});
