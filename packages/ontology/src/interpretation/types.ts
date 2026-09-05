import type { UUID, WorldRef } from '../../../kernel/src/ids.js';
import type { ReleasedConversion } from '../../../kernel/src/decimal.js';

export type MeasureKind = 'money' | 'quantity';

/** Input claim for CompareClaims — synthetic records at the component boundary. */
export type InterpretationClaim = Readonly<{
  claimId: UUID;
  predicateId: string;
  subjectId: UUID;
  amount: string;
  unitOrCurrency: string;
  measureKind: MeasureKind;
  scope: Readonly<Record<string, string>>;
  validFrom: string;
  validUntil: string | null;
  /** Forbidden rivals stay authorized=false and must not affect view-local counts. */
  authorized: boolean;
}>;

export type MeaningProfile = Readonly<{
  profileId: string;
  knowledgeVersion: number;
  releaseDigest: string;
  /** Released evidence-bound unit/currency factors only; never invent conversions. */
  releasedConversions: readonly ReleasedConversion[];
}>;

export type CompareClaimsInput = Readonly<{
  world: WorldRef;
  claims: readonly InterpretationClaim[];
  meaningProfile: MeaningProfile;
}>;

export type ComparableGroup = Readonly<{
  comparisonKey: string;
  predicateId: string;
  subjectId: UUID;
  scopeDigest: string;
  validFrom: string;
  validUntil: string | null;
  claimIds: readonly UUID[];
  amounts: readonly string[];
  unitOrCurrency: string;
  measureKind: MeasureKind;
  metricLabel: string;
}>;

export type NonComparableReason =
  | 'DISTINCT_PREDICATE'
  | 'SCOPE_MISMATCH'
  | 'INTERVAL_MISMATCH'
  | 'INCOMPATIBLE_UNIT'
  | 'MISSING_CONVERSION';

export type NonComparablePartition = Readonly<{
  reason: NonComparableReason;
  predicateIds: readonly string[];
  claimIds: readonly UUID[];
  explanation: string;
}>;

export type CompareClaimsOk = Readonly<{
  tag: 'Ok';
  runId: UUID;
  groups: readonly ComparableGroup[];
  partitions: readonly NonComparablePartition[];
  numericalContradiction: boolean;
  winnerSelected: false;
  explanations: readonly string[];
  resultDigest: string;
  meaningBasis: string;
  firstRun: boolean;
  authorizedClaimCount: number;
  omittedUnauthorizedCount: number;
}>;

export type CompareClaimsDenied = Readonly<{
  tag: 'Denied';
  reason: 'EMPTY_CLAIMS' | 'INVALID_CLAIM';
  detail?: string;
}>;

export type CompareClaimsOutcome = CompareClaimsOk | CompareClaimsDenied;
