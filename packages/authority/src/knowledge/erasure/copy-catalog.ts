/**
 * Knowledge-facing re-export of ZA-12 copy-catalog admission laws.
 * Implementation lives in ports/erasure (no circular ports→knowledge import).
 */
export {
  admitsFullErasureOrRestore,
  blocksAdmission,
  copyBelongsToWorld,
  isExplainedDisposition,
  isRestoreEligible,
  publicationAllowedDuringClosing,
} from "../../ports/erasure/copy-catalog-laws.js";
