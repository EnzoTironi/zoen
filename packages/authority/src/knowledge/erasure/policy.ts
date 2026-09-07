import { ErasurePolicyProfileId } from "@zoen/contracts/erasure/values";
import { Blocked, InvalidInput } from "@zoen/contracts/worlds/errors";
import { Effect, Schema } from "effect";

import {
  DataPolicy,
  DataPolicySchema,
  ErasableDataPolicySchema,
} from "../../ports/worlds/context.js";

/** Closing requires the candidate erasable profile; retained Worlds stay blocked. */
export const requireErasablePolicy = Effect.fn("erasure.requireErasablePolicy")(
  function* requireErasablePolicy(policyVersion: string) {
    const policy = yield* Schema.decodeEffect(DataPolicySchema)(
      yield* DataPolicy
    ).pipe(Effect.mapError(() => new Blocked({ code: "PROFILE_BLOCKED" })));
    if (!Schema.is(ErasableDataPolicySchema)(policy) || !policy.erasure) {
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
