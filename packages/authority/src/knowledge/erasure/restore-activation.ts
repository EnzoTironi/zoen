/**
 * Knowledge-facing ZA-13 restore activation: re-exports laws and applies the
 * controller/content fence for restored installs.
 */
import { NotFoundOrDenied, Unavailable } from "@zoen/contracts/worlds/errors";
import type { WorldRef } from "@zoen/contracts/worlds/values";
import { Effect } from "effect";

import {
  ErasureAttemptRegister,
  blocksWorldContentAdmission,
} from "../../ports/erasure/attempt-register.js";
import { admitsPrincipalUnderCurrentRights } from "../../ports/erasure/restore-activation-laws.js";
import { ErasureRestoreActivation } from "../../ports/erasure/restore-activation.js";

export {
  allowsContentServingReadiness,
  currentRestoreActivationQualification,
  decideRestorePromotion,
  gatesAdmitRestorePromotion,
  linearizeErasureVersusActivation,
  phaseAllowsContentServing,
  phaseAllowsCredentialPromotion,
} from "../../ports/erasure/restore-activation-laws.js";
export type {
  ErasureActivationOrder,
  ErasureActivationRace,
  PromotionDecision,
  RestoreAdmissionPhase,
  RestoreActivationQualification,
  RestoredPrincipalRights,
} from "../../ports/erasure/restore-activation-laws.js";

/**
 * After a restore, refuse content unless the activation protocol has admitted
 * serving and current rights still allow the principal. Erased/uncertain
 * controller scopes remain suppressed via observeWorld.
 */
export const requireRestoreAlignedContent = Effect.fn(
  "erasure.requireRestoreAlignedContent"
)(function* requireRestoreAlignedContent(
  world: WorldRef,
  principalId: string | null
) {
  const activation = yield* ErasureRestoreActivation;
  const observation = yield* activation.observe;
  if (observation.phase === "NotRestored") {
    return yield* Effect.void;
  }

  // Quarantined / Preparing / PromotionBlocked: no content-serving window.
  yield* activation.requireContentServing;

  const register = yield* ErasureAttemptRegister;
  const suppression = yield* register.observeWorld(world);
  if (blocksWorldContentAdmission(suppression)) {
    return yield* new NotFoundOrDenied({ code: "NOT_FOUND_OR_DENIED" });
  }

  if (principalId !== null) {
    const rights = yield* activation.observeCurrentRights(world, principalId);
    if (!admitsPrincipalUnderCurrentRights(rights)) {
      return yield* new NotFoundOrDenied({ code: "NOT_FOUND_OR_DENIED" });
    }
  }
  return yield* Effect.void;
});

/** Credential/session promotion from restored backups — fail closed. */
export const requireRestoreCredentialPromotion = Effect.fn(
  "erasure.requireRestoreCredentialPromotion"
)(function* requireRestoreCredentialPromotion() {
  const activation = yield* ErasureRestoreActivation;
  return yield* activation.requireCredentialPromotion.pipe(
    Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
  );
});
