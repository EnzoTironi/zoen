import { describe, expect, it } from "@effect/vitest";
import { Result, Schema } from "effect";

import {
  HostedRetainedDataPolicy,
  HostedRetainedPolicyProfileId,
  HostedSchemaVersion,
} from "../../../src/hosted/policy/values.js";

const hostedRetained = {
  dataScope: "admitted-non-sensitive" as const,
  enabledRealm: "live" as const,
  erasure: false as const,
  legalHold: false as const,
  licensedExpiry: false as const,
  profileId: "d04-hosted-retained-v1" as const,
  restoreAfterErasure: false as const,
  retention: "while-pinned" as const,
};

describe("EX36 hosted retained policy schemas", () => {
  it("round-trips d04-hosted-retained-v1 with erasure and restore closed", () => {
    const decoded = Schema.decodeSync(HostedRetainedDataPolicy)(hostedRetained);
    expect(decoded).toStrictEqual(hostedRetained);
    expect(decoded.erasure).toBeFalsy();
    expect(decoded.restoreAfterErasure).toBeFalsy();
    expect(Schema.encodeSync(HostedRetainedDataPolicy)(decoded)).toStrictEqual(
      hostedRetained
    );
  });

  it("pins retained scope, realm, and retention literals", () => {
    const decoded = Schema.decodeSync(HostedRetainedDataPolicy)(hostedRetained);
    expect(decoded.dataScope).toBe("admitted-non-sensitive");
    expect(decoded.enabledRealm).toBe("live");
    expect(decoded.retention).toBe("while-pinned");
    expect(decoded.profileId).toBe("d04-hosted-retained-v1");
  });

  it("accepts only the hosted retained profile id literal", () => {
    expect(
      Schema.decodeSync(HostedRetainedPolicyProfileId)("d04-hosted-retained-v1")
    ).toBe("d04-hosted-retained-v1");
    expect(
      Result.isFailure(
        Schema.decodeUnknownResult(HostedRetainedPolicyProfileId)(
          "worlds-local-retained-v1"
        )
      )
    ).toBeTruthy();
    expect(
      Result.isFailure(
        Schema.decodeUnknownResult(HostedRetainedPolicyProfileId)(
          "d03-local-erasable-v1"
        )
      )
    ).toBeTruthy();
  });

  it("rejects erasure, restore-after-erasure, and foreign profile ids", () => {
    for (const amendment of [
      { erasure: true },
      { restoreAfterErasure: true },
      { profileId: "worlds-local-retained-v1" },
      { profileId: "d03-local-erasable-v1" },
    ]) {
      expect(
        Result.isFailure(
          Schema.decodeUnknownResult(HostedRetainedDataPolicy)({
            ...hostedRetained,
            ...amendment,
          })
        )
      ).toBeTruthy();
    }
  });

  it("rejects sensitive scope, evaluation realm, holds, and odd retention", () => {
    for (const amendment of [
      { dataScope: "sensitive" },
      { enabledRealm: "evaluation" },
      { legalHold: true },
      { licensedExpiry: true },
      { retention: "forever" },
    ]) {
      expect(
        Result.isFailure(
          Schema.decodeUnknownResult(HostedRetainedDataPolicy)({
            ...hostedRetained,
            ...amendment,
          })
        )
      ).toBeTruthy();
    }
  });

  it("keeps hosted schema version distinct from erasure/d01 wire tags", () => {
    expect(Schema.decodeSync(HostedSchemaVersion)("hosted.v1")).toBe(
      "hosted.v1"
    );
    expect(
      Result.isFailure(
        Schema.decodeUnknownResult(HostedSchemaVersion)("erasure.v1")
      )
    ).toBeTruthy();
    expect(
      Result.isFailure(
        Schema.decodeUnknownResult(HostedSchemaVersion)("worlds.v1")
      )
    ).toBeTruthy();
  });
});
