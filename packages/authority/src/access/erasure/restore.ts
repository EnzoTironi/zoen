import { Unavailable } from "@zoen/contracts/worlds/errors";
import type { WorldRef } from "@zoen/contracts/worlds/values";
import { Effect } from "effect";

import { requireRestoreAlignedContent } from "../../knowledge/erasure/restore-activation.js";
import {
  allowsContentServingReadiness,
  currentRestoreActivationQualification,
} from "../../ports/erasure/restore-activation-laws.js";
import { ErasureRestoreActivation } from "../../ports/erasure/restore-activation.js";

/**
 * World content / credential gate for restored installs (ZA-13).
 * Quarantine is an admission state on the single runtime — not a dual truth.
 */
export const admitRestoredWorldAccess = Effect.fn(
  "authority.access.admitRestoredWorldAccess"
)(function* admitRestoredWorldAccess(world: WorldRef, principalId: string) {
  yield* requireRestoreAlignedContent(world, principalId);
});

/**
 * Content-serving readiness probe used by HTTP /ready when a restore
 * quarantine is active. Controller/rights unknown → not ready.
 */
export const probeRestoredContentServingReadiness = Effect.fn(
  "authority.access.probeRestoredContentServingReadiness"
)(function* probeRestoredContentServingReadiness(input?: {
  readonly controllerFresh?: boolean;
  readonly rightsKnown?: boolean;
}) {
  const activation = yield* ErasureRestoreActivation;
  const observation = yield* activation.observe;
  const qualification = yield* activation.qualification;
  const allowed = allowsContentServingReadiness({
    controllerFresh: input?.controllerFresh ?? true,
    phase: observation.phase,
    qualification,
    rightsKnown: input?.rightsKnown ?? observation.phase === "NotRestored",
  });
  if (!allowed) {
    return yield* new Unavailable({ code: "UNAVAILABLE" });
  }
  if (observation.phase !== "NotRestored") {
    yield* activation.requireContentServing;
  }
  // Keep freeze F04 visible: Object Lock restoreAfterErasure stays Unknown.
  if (
    currentRestoreActivationQualification().objectLockRestoreAfterErasure !==
    "Unknown"
  ) {
    return yield* new Unavailable({ code: "UNAVAILABLE" });
  }
  return yield* Effect.void;
});
