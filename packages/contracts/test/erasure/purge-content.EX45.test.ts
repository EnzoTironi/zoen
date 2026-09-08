import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

import {
  PurgeWorldContent,
  WorldContentPurged,
} from "../../src/erasure/operations.js";

describe("EX45 PurgeWorldContent schemas", () => {
  it("decodes purge request and success with restoreAfterErasure false", () => {
    const request = Schema.decodeSync(PurgeWorldContent)({
      input: {
        closingOperationId: "11111111-1111-4111-8111-111111111111",
        expectedErasureRevision: "1",
      },
      operation: "PurgeWorldContent",
      operationId: "22222222-2222-4222-8222-222222222222",
      purpose: "personal-records",
      schemaVersion: "erasure.v1",
      worldRef: {
        realm: "live",
        worldId: "33333333-3333-4333-8333-333333333333",
      },
    });
    expect(request.operation).toBe("PurgeWorldContent");

    const success = Schema.decodeSync(WorldContentPurged)({
      _tag: "WorldContentPurged",
      attemptExternalState: "Confirmed",
      attestationScope: "local-controlled-copies",
      objectVersionsRemoved: 0,
      phase: "Erased",
      policyVersion: "worlds-local-erasable-v1",
      receiptRef: "44444444-4444-4444-8444-444444444444",
      restoreAfterErasure: false,
      revision: "2",
      sqlContentPurged: true,
      worldRef: request.worldRef,
    });
    expect(success.restoreAfterErasure).toBeFalsy();
    expect(success.attestationScope).toBe("local-controlled-copies");
    expect(success.phase).toBe("Erased");
  });

  it("rejects restoreAfterErasure true", () => {
    expect(() =>
      Schema.decodeUnknownSync(WorldContentPurged)({
        _tag: "WorldContentPurged",
        attemptExternalState: "Confirmed",
        attestationScope: "local-controlled-copies",
        objectVersionsRemoved: 0,
        phase: "Erased",
        policyVersion: "worlds-local-erasable-v1",
        receiptRef: "44444444-4444-4444-8444-444444444444",
        restoreAfterErasure: true,
        revision: "2",
        sqlContentPurged: true,
        worldRef: {
          realm: "live",
          worldId: "33333333-3333-4333-8333-333333333333",
        },
      })
    ).toThrow(/./u);
  });
});
