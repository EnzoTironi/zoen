import { ErasurePolicyProfileId } from "@zoen/contracts/erasure/values";
import { Blocked, InvalidInput } from "@zoen/contracts/worlds/errors";
import { Effect, Schema } from "effect";

import {
  DataPolicy,
  DataPolicySchema,
  ErasableDataPolicySchema,
  HostedErasableDataPolicySchema,
} from "../../ports/worlds/context.js";
import type { DataPolicySchema as DataPolicyValue } from "../../ports/worlds/context.js";

/**
 * Closing requires an erasable profile (local or hosted). Retained Worlds stay
 * blocked. Hosted erasable additionally requires HostedErasableAdmission before
 * destructive work (see hosted-erasable-gate.ts).
 */
export const requireErasablePolicy = Effect.fn("erasure.requireErasablePolicy")(
  function* requireErasablePolicy(policyVersion: string) {
    const policy = yield* Schema.decodeEffect(DataPolicySchema)(
      yield* DataPolicy
    ).pipe(Effect.mapError(() => new Blocked({ code: "PROFILE_BLOCKED" })));
    const isLocalErasable = Schema.is(ErasableDataPolicySchema)(policy);
    const isHostedErasable = Schema.is(HostedErasableDataPolicySchema)(policy);
    if ((!isLocalErasable && !isHostedErasable) || !policy.erasure) {
      return yield* new Blocked({ code: "PROFILE_BLOCKED" });
    }
    if (policy.restoreAfterErasure) {
      return yield* new Blocked({ code: "PROFILE_BLOCKED" });
    }
    const expected = yield* Schema.decodeUnknownEffect(ErasurePolicyProfileId)(
      policyVersion
    ).pipe(Effect.mapError(() => new InvalidInput({ code: "INVALID_INPUT" })));
    if (expected !== policy.profileId) {
      return yield* new InvalidInput({ code: "INVALID_INPUT" });
    }
    return policy;
  }
);

export const isHostedErasablePolicy = (policy: DataPolicyValue): boolean =>
  Schema.is(HostedErasableDataPolicySchema)(policy);
