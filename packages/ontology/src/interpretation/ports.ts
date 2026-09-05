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

import type { FamilySupportInput, FamilySupportResult } from './families.js';

export type { FamilySupportInput, FamilySupportResult };

export interface FamilySupportPort {
  /** Pure boundary — no I/O. */
  computeFamilySupport(input: FamilySupportInput): FamilySupportResult;
}
