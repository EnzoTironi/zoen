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
export { ImpactService, IMPACT_IMPL, DEFAULT_IMPACT_BUDGET } from './impact.js';
export type {
  ImpactNodeKind,
  ImpactNodeStatus,
  RegisterImpactNodeInput,
  RegisterImpactEdgeInput,
  ConsumeCorrectionImpactInput,
  QualityDimensions,
  ImpactReceipt,
  ImpactOk,
  ImpactStale,
  ImpactDenied,
  ImpactOutcome,
} from './impact.js';
export type { ImpactPort } from './ports.js';
export { InterpretationLaws, LAWS_IMPL } from './interpretation-laws.js';
export type {
  DeclassificationRule,
  VisibleEquivalenceInput,
  CutReplayInput,
  ObservableProjection,
  LawsProof,
  LawsOk,
  LawsStale,
  LawsDenied,
  LawsOutcome,
} from './interpretation-laws.js';
export type { InterpretationLawsPort } from './ports.js';
