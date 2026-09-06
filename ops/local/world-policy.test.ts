import { describe, expect, it } from "vitest";

import {
  LOCAL_WORLD_POLICY_IDS,
  isLocalWorldPolicyId,
  resolveLocalWorldPolicy,
} from "./world-policy.ts";

describe("ops/local world-policy (EX39)", () => {
  it("defaults retained and admits erasable + hosted retained only", () => {
    expect(LOCAL_WORLD_POLICY_IDS).toStrictEqual([
      "d01-local-retained-v1",
      "d03-local-erasable-v1",
      "d04-hosted-retained-v1",
    ]);
    expect(isLocalWorldPolicyId("d04-hosted-retained-v1")).toBeTruthy();
    expect(isLocalWorldPolicyId("d99-unknown")).toBeFalsy();
  });

  it("hosted retained keeps erasure and restoreAfterErasure closed", () => {
    const policy = resolveLocalWorldPolicy("d04-hosted-retained-v1");
    expect(policy).toMatchObject({
      dataScope: "admitted-non-sensitive",
      erasure: false,
      profileId: "d04-hosted-retained-v1",
      restoreAfterErasure: false,
      retention: "while-pinned",
    });
  });

  it("rejects unknown policy ids", () => {
    expect(resolveLocalWorldPolicy("d01-local-retained-v2")).toBeNull();
  });
});
