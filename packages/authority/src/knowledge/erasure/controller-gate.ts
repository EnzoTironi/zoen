import { NotFoundOrDenied } from "@zoen/contracts/worlds/errors";
import type { WorldRef } from "@zoen/contracts/worlds/values";
import { Effect } from "effect";

import {
  ErasureAttemptRegister,
  blocksWorldContentAdmission,
} from "../../ports/erasure/attempt-register.js";
import { isFullIndependentControllerAdmitted } from "../../ports/erasure/qualification.js";
import type { ErasureControllerQualification } from "../../ports/erasure/qualification.js";

/**
 * ZA-11 reconciliation posture: controller knowledge of a blocking attempt keeps
 * content closed even when a restored application DB looks Active. There is no
 * silent Abort and no restoreAfterErasure elevation from this gate.
 */
export const requireControllerAlignedContent = Effect.fn(
  "erasure.requireControllerAlignedContent"
)(function* requireControllerAlignedContent(world: WorldRef) {
  const register = yield* ErasureAttemptRegister;
  const observation = yield* register.observeWorld(world);
  if (blocksWorldContentAdmission(observation)) {
    return yield* new NotFoundOrDenied({ code: "NOT_FOUND_OR_DENIED" });
  }
  return observation;
});

/** Full/hosted controller activation — fail closed unless H-01 + G-OPS qualify. */
export const assertFullControllerNotActivated = (
  qualification: ErasureControllerQualification
): boolean => isFullIndependentControllerAdmitted(qualification);
