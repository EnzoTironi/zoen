import { describe, expect, it } from "@effect/vitest";
import { OperationId, WorldId } from "@zoen/contracts/d01/values";
import { Effect, Schema } from "effect";

import {
  DataPolicySchema,
  PrincipalId,
} from "../../../src/ports/d01/context.js";
import {
  ErasureAttemptRegister,
  blocksWorldActivation,
} from "../../../src/ports/erasure/attempt-register.js";

const blockedIdentity = {
  deploymentEpoch: "test-epoch",
  operationId: Schema.decodeSync(OperationId)(
    "00000000-0000-4000-8000-000000000010"
  ),
  principalId: Schema.decodeSync(PrincipalId)(
    "00000000-0000-4000-8000-000000000011"
  ),
  worldRef: {
    realm: "live" as const,
    worldId: Schema.decodeSync(WorldId)("00000000-0000-4000-8000-000000000012"),
  },
};

const blockedIntention = {
  confirmEntireWorld: true as const,
  expectedErasureRevision: null,
  policyVersion: "d03-local-erasable-v1",
};

describe("EX30/EX31 erasure gates still blocked", () => {
  it("retained DataPolicy forbids erasure and restore-after-erasure", () => {
    const policy = Schema.decodeSync(DataPolicySchema)({
      dataScope: "admitted-non-sensitive",
      enabledRealm: "live",
      erasure: false,
      legalHold: false,
      licensedExpiry: false,
      profileId: "d01-local-retained-v1",
      restoreAfterErasure: false,
      retention: "while-pinned",
    });
    expect(policy.erasure).toBeFalsy();
    expect(policy.restoreAfterErasure).toBeFalsy();
  });

  it.effect(
    "unqualified controller port stays Unavailable (no fake Confirmed)",
    () =>
      Effect.gen(function* blocked() {
        const register = yield* ErasureAttemptRegister;
        const exit = yield* Effect.exit(
          register.register(blockedIdentity, blockedIntention)
        );
        expect(exit._tag).toBe("Failure");
      }).pipe(Effect.provide(ErasureAttemptRegister.unqualifiedLayer))
  );

  it("Registered and Unknown block world activation; terminals do not reopen", () => {
    expect(blocksWorldActivation("Registered")).toBeTruthy();
    expect(blocksWorldActivation("Unknown")).toBeTruthy();
    expect(blocksWorldActivation("Confirmed")).toBeFalsy();
    expect(blocksWorldActivation("Aborted")).toBeFalsy();
  });
});
