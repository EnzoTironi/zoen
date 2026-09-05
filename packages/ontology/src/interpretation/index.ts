/** Ontology interpretation package entry (SPEC-005) — ZN-0031 comparability segment. */
export {
  ClaimComparer,
  COMPARER_IMPL,
  buildComparisonKey,
  metricLabelForPredicate,
} from './comparability.js';
export type {
  MeasureKind,
  InterpretationClaim,
  MeaningProfile,
  CompareClaimsInput,
  ComparableGroup,
  NonComparableReason,
  NonComparablePartition,
  CompareClaimsOk,
  CompareClaimsDenied,
  CompareClaimsOutcome,
} from './types.js';
export type { CompareClaimsPort } from './ports.js';
export {
  computeFamilySupport,
  resolveRoot,
  evidenceSetDigest,
  FAMILIES_IMPL,
} from './families.js';
export type {
  EvidenceLink,
  EvidenceLinkKind,
  FamilySupportInput,
  IndependentFamily,
  FamilySupportOk,
  FamilySupportError,
  FamilySupportResult,
} from './families.js';
export type { FamilySupportPort } from './ports.js';
export { Interpreter, INTERPRET_IMPL } from './interpret.js';
export type {
  InterpretCandidate,
  PrecedenceRule,
  InterpretBasis,
  InterpretInput,
  InterpretationStatus,
  VerificationAxis,
  InterpretationRecord,
  InterpretOk,
  InterpretDenied,
  InterpretOutcome,
} from './interpret.js';
export type { InterpretPort } from './ports.js';
export { CorrectionService, CORRECTION_IMPL } from './correction.js';
export type {
  AnswerKind,
  CaseGuards,
  ApplyCorrectionInput,
  RetractCorrectionInput,
  CorrectionReceipt,
  CorrectionOk,
  CorrectionStale,
  CorrectionDenied,
  CorrectionOutcome,
} from './correction.js';
export type { CorrectionPort } from './ports.js';
