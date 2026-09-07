import { describe, expect, it } from "@effect/vitest";
import { Result, Schema } from "effect";

import { HostedRetainedDataPolicySchema } from "../../../src/ports/hosted/policy.js";
import {
  DataPolicySchema,
  ErasableDataPolicySchema,
  RetainedDataPolicySchema,
} from "../../../src/ports/worlds/context.js";

const retainedLocal = {
  dataScope: "admitted-non-sensitive" as const,
  enabledRealm: "live" as const,
  erasure: false as const,
  legalHold: false as const,
  licensedExpiry: false as const,
  profileId: "worlds-local-retained-v1" as const,
  restoreAfterErasure: false as const,
  retention: "while-pinned" as const,
};

const erasableLocal = {
  dataScope: "admitted-non-sensitive" as const,
  enabledRealm: "live" as const,
  erasure: true as const,
  legalHold: false as const,
  licensedExpiry: false as const,
  profileId: "d03-local-erasable-v1" as const,
  restoreAfterErasure: false as const,
  retention: "while-pinned" as const,
};

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

describe("EX36 DataPolicy union includes hosted retained", () => {
  it("decodes hosted retained via port schema and DataPolicySchema", () => {
    const viaPort = Schema.decodeSync(HostedRetainedDataPolicySchema)(
      hostedRetained
    );
    const viaUnion = Schema.decodeSync(DataPolicySchema)(hostedRetained);
    expect(viaPort).toStrictEqual(hostedRetained);
    expect(viaUnion).toStrictEqual(hostedRetained);
    expect(viaUnion.erasure).toBeFalsy();
    expect(viaUnion.restoreAfterErasure).toBeFalsy();
  });

  it("classifies hosted under HostedRetainedDataPolicySchema only", () => {
    const viaUnion = Schema.decodeSync(DataPolicySchema)(hostedRetained);
    expect(Schema.is(HostedRetainedDataPolicySchema)(viaUnion)).toBeTruthy();
    expect(Schema.is(RetainedDataPolicySchema)(viaUnion)).toBeFalsy();
    expect(Schema.is(ErasableDataPolicySchema)(viaUnion)).toBeFalsy();
  });

  it("keeps local retained distinct from hosted", () => {
    const retained = Schema.decodeSync(DataPolicySchema)(retainedLocal);
    expect(Schema.is(RetainedDataPolicySchema)(retained)).toBeTruthy();
    expect(Schema.is(HostedRetainedDataPolicySchema)(retained)).toBeFalsy();
    expect(retained.profileId).toBe("worlds-local-retained-v1");
    expect(retained.erasure).toBeFalsy();
  });

  it("keeps local erasable distinct from hosted", () => {
    const erasable = Schema.decodeSync(DataPolicySchema)(erasableLocal);
    expect(Schema.is(ErasableDataPolicySchema)(erasable)).toBeTruthy();
    expect(Schema.is(HostedRetainedDataPolicySchema)(erasable)).toBeFalsy();
    expect(erasable.profileId).toBe("d03-local-erasable-v1");
    expect(erasable.erasure).toBeTruthy();
  });

  it("rejects hosted amendments that would enable erasure or restore", () => {
    for (const amendment of [
      { erasure: true },
      { restoreAfterErasure: true },
      { erasure: false, profileId: "worlds-local-retained-v1" },
    ]) {
      expect(
        Result.isFailure(
          Schema.decodeUnknownResult(HostedRetainedDataPolicySchema)({
            ...hostedRetained,
            ...amendment,
          })
        )
      ).toBeTruthy();
    }
  });

  it("rejects erasable flags remapped onto the hosted profile id", () => {
    expect(
      Result.isFailure(
        Schema.decodeUnknownResult(HostedRetainedDataPolicySchema)({
          ...erasableLocal,
          profileId: "d04-hosted-retained-v1",
        })
      )
    ).toBeTruthy();
  });
});
