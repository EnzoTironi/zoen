import type {
  CompareClaimsInput,
  CompareClaimsOutcome,
  ComparableGroup,
  InterpretationClaim,
  MeaningProfile,
  NonComparablePartition,
  NonComparableReason,
  MeasureKind,
  CompareClaimsOk,
  CompareClaimsDenied,
} from './types.js';

export type {
  CompareClaimsInput,
  CompareClaimsOutcome,
  ComparableGroup,
  InterpretationClaim,
  MeaningProfile,
  NonComparablePartition,
  NonComparableReason,
  MeasureKind,
  CompareClaimsOk,
  CompareClaimsDenied,
};

export interface CompareClaimsPort {
  compareClaims(input: CompareClaimsInput): Promise<CompareClaimsOutcome>;
}
