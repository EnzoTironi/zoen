import { describe, expect, it } from "vitest";

import {
  LOCAL_WORLD_POLICY_IDS,
  isLocalWorldPolicyId,
  resolveLocalWorldPolicy,
} from "./world-policy.ts";

describe("ops/local world-policy (EX39)", () => {
  it("defaults retained and admits erasable + hosted retained/erasable only", () => {
    expect(LOCAL_WORLD_POLICY_IDS).toStrictEqual([
      "worlds-local-retained-v1",
      "worlds-local-erasable-v1",
      "worlds-hosted-retained-v1",
      "worlds-hosted-erasable-v1",
    ]);
    expect(isLocalWorldPolicyId("worlds-hosted-retained-v1")).toBeTruthy();
    expect(isLocalWorldPolicyId("worlds-hosted-erasable-v1")).toBeTruthy();
    expect(isLocalWorldPolicyId("d99-unknown")).toBeFalsy();
  });

  it("hosted retained keeps erasure and restoreAfterErasure closed", () => {
    const policy = resolveLocalWorldPolicy("worlds-hosted-retained-v1");
    expect(policy).toMatchObject({
      dataScope: "admitted-non-sensitive",
      erasure: false,
      profileId: "worlds-hosted-retained-v1",
      restoreAfterErasure: false,
      retention: "while-pinned",
    });
  });

  it("hosted erasable admits erasure with restoreAfterErasure closed", () => {
    const policy = resolveLocalWorldPolicy("worlds-hosted-erasable-v1");
    expect(policy).toMatchObject({
      dataScope: "admitted-non-sensitive",
      erasure: true,
      profileId: "worlds-hosted-erasable-v1",
      restoreAfterErasure: false,
      retention: "while-pinned",
    });
  });

  it("rejects unknown policy ids", () => {
    expect(resolveLocalWorldPolicy("worlds-local-retained-v2")).toBeNull();
  });

  it("rejects obsolete delivery policy ids (ZA-03)", () => {
    expect(resolveLocalWorldPolicy("d03-local-erasable-v1")).toBeNull();
    expect(resolveLocalWorldPolicy("d04-hosted-retained-v1")).toBeNull();
    expect(isLocalWorldPolicyId("d03-local-erasable-v1")).toBeFalsy();
    expect(isLocalWorldPolicyId("d04-hosted-retained-v1")).toBeFalsy();
  });
});
