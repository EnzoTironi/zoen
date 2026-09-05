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
