import type {
  ControlledCopyAdmissionPurpose,
  ControlledCopyCoverageStatus,
  ControlledCopyDisposition,
  ControlledCopyRecord,
} from "./copy-catalog.js";

/**
 * Pure admission laws for ZA-12. Unknown / Incomplete never admit Full Erased
 * or restore. Quarantined and unpublished copies are never restore-eligible.
 */

export const admitsFullErasureOrRestore = (
  status: ControlledCopyCoverageStatus
): boolean => status === "BoundedComplete";

export const blocksAdmission = (
  status: ControlledCopyCoverageStatus,
  _purpose: ControlledCopyAdmissionPurpose
): boolean => !admitsFullErasureOrRestore(status);

/** Published + accounted/retained/suppressed dispositions only. */
export const isRestoreEligible = (copy: ControlledCopyRecord): boolean => {
  if (copy.publishedAt === null) {
    return false;
  }
  switch (copy.disposition) {
    case "AccountedActive":
    case "RetainedUnderHold":
    case "SuppressedOnRestore": {
      return true;
    }
    case "Erased":
    case "QuarantinedUnpublishable":
    case "Unaccounted":
    case "Unknown": {
      return false;
    }
    default: {
      const _exhaustive: never = copy.disposition;
      return _exhaustive;
    }
  }
};

export const isExplainedDisposition = (
  disposition: ControlledCopyDisposition
): boolean =>
  disposition === "Erased" ||
  disposition === "RetainedUnderHold" ||
  disposition === "SuppressedOnRestore" ||
  disposition === "QuarantinedUnpublishable" ||
  disposition === "AccountedActive";

export const copyBelongsToWorld = (
  copy: ControlledCopyRecord,
  worldId: string,
  realm: "live"
): boolean => {
  if (copy.scopeKind !== "world" || copy.worldRef === null) {
    return false;
  }
  return copy.worldRef.worldId === worldId && copy.worldRef.realm === realm;
};

/**
 * Closing-race rule: an unregistered snapshot caught during Closing cannot be
 * published; it must be quarantined (or registration must precede Closing).
 */
export const publicationAllowedDuringClosing = (args: {
  readonly alreadyRegisteredBeforeClosing: boolean;
  readonly worldClosing: boolean;
}): boolean => !args.worldClosing || args.alreadyRegisteredBeforeClosing;
