/**
 * ZA-13 restore-activation laws (pure).
 *
 * Restored installs always start Quarantined. Promotion to content-serving
 * requires independent suppression + current rights under a single admitted
 * protocol. G-STORAGE-FENCE / G-OPS / H-01 remain Blocked/Unknown today —
 * never invent Qualified or restoreAfterErasure:true. Object Lock does not
 * qualify restoreAfterErasure (stays Unknown).
 */

import type { ErasureWorldSuppressionObservation } from "./attempt-register.js";
import { blocksWorldContentAdmission } from "./attempt-register.js";
import { admitsFullErasureOrRestore } from "./copy-catalog-laws.js";
import type { ControlledCopyCoverageStatus } from "./copy-catalog.js";
import type { StorageFenceQualification } from "./object-write.js";

/** Admission phases for a restored install (quarantine is not a second truth). */
export type RestoreAdmissionPhase =
  | "Quarantined"
  | "Preparing"
  | "PromotionBlocked"
  | "Active";

export type RestoreGateStatus = "Blocked" | "Unknown" | "Qualified";

/**
 * Honest qualification surface for restoreAfterErasure product activation.
 * Literal `restoreAfterErasure: false` until every gate is Qualified.
 */
export interface RestoreActivationQualification {
  readonly gOps: RestoreGateStatus;
  readonly gStorageFence: StorageFenceQualification;
  readonly h01: RestoreGateStatus;
  /** Object Lock probes never admit restoreAfterErasure. */
  readonly objectLockRestoreAfterErasure: "Unknown";
  readonly restoreAfterErasure: false;
}

/** Current product posture — do not fake clearance. */
export const currentRestoreActivationQualification =
  (): RestoreActivationQualification => ({
    gOps: "Unknown",
    gStorageFence: "Blocked",
    h01: "Blocked",
    objectLockRestoreAfterErasure: "Unknown",
    restoreAfterErasure: false,
  });

export const gatesAdmitRestorePromotion = (
  qualification: RestoreActivationQualification
): boolean =>
  // restoreAfterErasure is typed `false` until a future qualified profile flips
  // the product flag; gate clearance alone is required here and remains unmet.
  qualification.h01 === "Qualified" &&
  qualification.gOps === "Qualified" &&
  qualification.gStorageFence === "Qualified";

/** Quarantine / blocked / preparing never serve protected content. */
export const phaseAllowsContentServing = (
  phase: RestoreAdmissionPhase
): boolean => phase === "Active";

export const phaseAllowsCredentialPromotion = (
  phase: RestoreAdmissionPhase
): boolean => phase === "Active";

export type RestoredPrincipalRights = "active" | "revoked" | "unknown";

/**
 * Current membership/delegation authority is independent of identity login and
 * of the restored SQL snapshot. Unknown or revoked → deny.
 */
export const admitsPrincipalUnderCurrentRights = (
  rights: RestoredPrincipalRights
): boolean => rights === "active";

export type ErasureActivationRace =
  | {
      readonly kind: "erasure-admitted-before-drain";
      readonly suppression: ErasureWorldSuppressionObservation;
    }
  | {
      readonly kind: "erasure-after-drain";
    }
  | {
      readonly kind: "old-writer-resume-after-seal";
    }
  | {
      readonly kind: "controller-unknown-or-stale";
      readonly suppression: ErasureWorldSuppressionObservation;
    };

export type ErasureActivationOrder =
  | {
      readonly order: "include-erasure-in-cut";
      readonly contentAdmitted: boolean;
    }
  | {
      readonly order: "defer-erasure-to-new-epoch";
      readonly oldEpochAdmitted: false;
    }
  | {
      readonly order: "reject-old-writer";
      readonly contentAdmitted: false;
    }
  | {
      readonly order: "block-promotion";
      readonly contentAdmitted: false;
    };

/**
 * Single admitted linearization for activation versus concurrently accepted
 * erasure. One last hash/head read is not this function — callers must supply
 * the durable controller observation and drain/seal posture.
 */
export const linearizeErasureVersusActivation = (
  race: ErasureActivationRace
): ErasureActivationOrder => {
  switch (race.kind) {
    case "erasure-admitted-before-drain": {
      // Erasure that entered before drain is part of the cut. Blocking
      // suppression keeps content closed; Clear/Aborted may proceed to rights.
      return {
        contentAdmitted: !blocksWorldContentAdmission(race.suppression),
        order: "include-erasure-in-cut",
      };
    }
    case "erasure-after-drain": {
      return { oldEpochAdmitted: false, order: "defer-erasure-to-new-epoch" };
    }
    case "old-writer-resume-after-seal": {
      return { contentAdmitted: false, order: "reject-old-writer" };
    }
    case "controller-unknown-or-stale": {
      return { contentAdmitted: false, order: "block-promotion" };
    }
    default: {
      const _exhaustive: never = race;
      return _exhaustive;
    }
  }
};

/** True when race linearization forbids promoting this activation cut. */
export const raceBlocksRestorePromotion = (
  order: ErasureActivationOrder
): boolean => {
  switch (order.order) {
    case "block-promotion":
    case "reject-old-writer": {
      return true;
    }
    case "include-erasure-in-cut": {
      return !order.contentAdmitted;
    }
    case "defer-erasure-to-new-epoch": {
      // Erasure is not part of this cut; promotion may continue on other checks.
      return false;
    }
    default: {
      const _exhaustive: never = order;
      return _exhaustive;
    }
  }
};

export interface PromotionPreconditions {
  readonly catalogCoverage: ControlledCopyCoverageStatus;
  readonly controllerSuppression: ErasureWorldSuppressionObservation;
  readonly phase: RestoreAdmissionPhase;
  readonly principalRights: RestoredPrincipalRights;
  readonly qualification: RestoreActivationQualification;
  readonly writersSettled: boolean;
}

export type PromotionDecision =
  | { readonly admitted: true; readonly phase: "Active" }
  | {
      readonly admitted: false;
      readonly phase: "PromotionBlocked" | "Quarantined" | "Preparing";
      readonly reason:
        | "gates-unqualified"
        | "suppression-blocks"
        | "rights-unknown-or-revoked"
        | "catalog-incomplete"
        | "writers-unsettled"
        | "not-preparing";
    };

/**
 * Bind promotion to current independent suppression, catalog coverage, writer
 * settlement, and rights. Fail closed on any Unknown/Blocked gate.
 */
export const decideRestorePromotion = (
  input: PromotionPreconditions
): PromotionDecision => {
  if (input.phase !== "Preparing" && input.phase !== "PromotionBlocked") {
    return {
      admitted: false,
      phase: input.phase === "Active" ? "PromotionBlocked" : input.phase,
      reason: "not-preparing",
    };
  }
  if (!gatesAdmitRestorePromotion(input.qualification)) {
    return {
      admitted: false,
      phase: "PromotionBlocked",
      reason: "gates-unqualified",
    };
  }
  if (blocksWorldContentAdmission(input.controllerSuppression)) {
    return {
      admitted: false,
      phase: "PromotionBlocked",
      reason: "suppression-blocks",
    };
  }
  if (!admitsPrincipalUnderCurrentRights(input.principalRights)) {
    return {
      admitted: false,
      phase: "PromotionBlocked",
      reason: "rights-unknown-or-revoked",
    };
  }
  if (!admitsFullErasureOrRestore(input.catalogCoverage)) {
    return {
      admitted: false,
      phase: "PromotionBlocked",
      reason: "catalog-incomplete",
    };
  }
  if (!input.writersSettled) {
    return {
      admitted: false,
      phase: "PromotionBlocked",
      reason: "writers-unsettled",
    };
  }
  return { admitted: true, phase: "Active" };
};

/** Content-serving readiness must stay closed while quarantine/gates block. */
export const allowsContentServingReadiness = (input: {
  readonly phase: RestoreAdmissionPhase | "NotRestored";
  readonly qualification: RestoreActivationQualification;
  readonly rightsKnown: boolean;
  readonly controllerFresh: boolean;
}): boolean => {
  if (input.phase === "NotRestored") {
    return true;
  }
  if (!input.controllerFresh || !input.rightsKnown) {
    return false;
  }
  if (!gatesAdmitRestorePromotion(input.qualification)) {
    return false;
  }
  return phaseAllowsContentServing(input.phase);
};
