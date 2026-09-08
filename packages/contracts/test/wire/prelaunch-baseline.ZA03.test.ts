import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

import { ErasurePolicyProfileId } from "../../src/erasure/values.js";
import { HostedRetainedPolicyProfileId } from "../../src/hosted/policy/values.js";
import { SharingRequest } from "../../src/sharing/operations.js";
import { SharingApiGroup } from "../../src/worlds/api.js";

const grant = {
  input: {
    expectedRevision: null,
    principalRef: "11111111-1111-4111-8111-111111111111",
  },
  operation: "GrantWorldReadAccess" as const,
  operationId: "22222222-2222-4222-8222-222222222222",
  purpose: "personal-records" as const,
  schemaVersion: "sharing.v1" as const,
  worldRef: {
    realm: "live" as const,
    worldId: "33333333-3333-4333-8333-333333333333",
  },
};

describe("ZA-03 prelaunch wire and baseline", () => {
  it("publishes sharing execute under /api/sharing/execute", () => {
    expect(SharingApiGroup.endpoints.execute.path).toBe("/api/sharing/execute");
  });

  it("rejects obsolete sharing schemaVersion and admits sharing.v1", () => {
    expect(Schema.is(SharingRequest)(grant)).toBeTruthy();
    expect(
      Schema.is(SharingRequest)({ ...grant, schemaVersion: "d03.sharing.v1" })
    ).toBeFalsy();
  });

  it("admits descriptive policy profile ids only", () => {
    expect(
      Schema.is(ErasurePolicyProfileId)("worlds-local-erasable-v1")
    ).toBeTruthy();
    expect(
      Schema.is(ErasurePolicyProfileId)("d03-local-erasable-v1")
    ).toBeFalsy();
    expect(
      Schema.is(HostedRetainedPolicyProfileId)("worlds-hosted-retained-v1")
    ).toBeTruthy();
    expect(
      Schema.is(HostedRetainedPolicyProfileId)("d04-hosted-retained-v1")
    ).toBeFalsy();
  });
});
