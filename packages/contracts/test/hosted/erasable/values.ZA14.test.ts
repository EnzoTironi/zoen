import { describe, expect, it } from "@effect/vitest";
import { Result, Schema } from "effect";

import {
  HostedErasableQualification,
  HostedErasableTarget,
} from "../../../src/hosted/erasable/values.js";
import {
  HostedErasableDataPolicy,
  HostedErasablePolicyProfileId,
} from "../../../src/hosted/policy/values.js";

const hostedErasable = {
  dataScope: "admitted-non-sensitive" as const,
  enabledRealm: "live" as const,
  erasure: true as const,
  legalHold: false as const,
  licensedExpiry: false as const,
  profileId: "worlds-hosted-erasable-v1" as const,
  restoreAfterErasure: false as const,
  retention: "while-pinned" as const,
};

describe("ZA-14 hosted erasable policy schemas", () => {
  it("round-trips worlds-hosted-erasable-v1 with restoreAfterErasure false", () => {
    const decoded = Schema.decodeSync(HostedErasableDataPolicy)(hostedErasable);
    expect(decoded.erasure).toBeTruthy();
    expect(decoded.restoreAfterErasure).toBeFalsy();
    expect(decoded.profileId).toBe("worlds-hosted-erasable-v1");
  });

  it("rejects restoreAfterErasure true and foreign profile ids", () => {
    expect(
      Result.isFailure(
        Schema.decodeUnknownResult(HostedErasableDataPolicy)({
          ...hostedErasable,
          restoreAfterErasure: true,
        })
      )
    ).toBeTruthy();
    expect(
      Result.isFailure(
        Schema.decodeUnknownResult(HostedErasablePolicyProfileId)(
          "worlds-hosted-retained-v1"
        )
      )
    ).toBeTruthy();
    expect(
      Result.isFailure(
        Schema.decodeUnknownResult(HostedErasableDataPolicy)({
          ...hostedErasable,
          erasure: false,
        })
      )
    ).toBeTruthy();
  });

  it("pins qualification productAccepted and fullHostedErased false", () => {
    const target = Schema.decodeSync(HostedErasableTarget)({
      appName: "zoen-erasable-proof",
      bucketName: "erasable-proof-bucket",
      imageDigest: "sha256:abc",
      installId: "install-1",
      profileId: "worlds-hosted-erasable-v1",
      volumeName: "erasable_data",
    });
    const qualification = Schema.decodeSync(HostedErasableQualification)({
      authorizedTarget: target,
      fullHostedErased: false,
      gOps: "Unknown",
      gStorageFence: "Blocked",
      h01: "Blocked",
      h02: "Blocked",
      localExactImageProofAdmitted: true,
      productAccepted: false,
      profileId: "worlds-hosted-erasable-v1",
      restoreAfterErasure: false,
      schemaVersion: "hosted.v1",
    });
    expect(qualification.productAccepted).toBeFalsy();
    expect(qualification.fullHostedErased).toBeFalsy();
  });
});
