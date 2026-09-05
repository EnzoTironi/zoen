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

import type { InterpretInput, InterpretOutcome } from './interpret.js';

export type { InterpretInput, InterpretOutcome };

export interface InterpretPort {
  interpret(input: InterpretInput): Promise<InterpretOutcome>;
}

import type {
  ApplyCorrectionInput,
  RetractCorrectionInput,
  CorrectionOutcome,
} from './correction.js';

export type { ApplyCorrectionInput, RetractCorrectionInput, CorrectionOutcome };

export interface CorrectionPort {
  applyCorrection(input: ApplyCorrectionInput): Promise<CorrectionOutcome>;
  retractCorrection(input: RetractCorrectionInput): Promise<CorrectionOutcome>;
}

import type {
  ConsumeCorrectionImpactInput,
  RegisterImpactNodeInput,
  RegisterImpactEdgeInput,
  ImpactOutcome,
} from './impact.js';

export type {
  ConsumeCorrectionImpactInput,
  RegisterImpactNodeInput,
  RegisterImpactEdgeInput,
  ImpactOutcome,
};

export interface ImpactPort {
  registerNode(input: RegisterImpactNodeInput): Promise<ImpactOutcome>;
  registerEdge(input: RegisterImpactEdgeInput): Promise<ImpactOutcome>;
  consumeCorrection(input: ConsumeCorrectionImpactInput): Promise<ImpactOutcome>;
}

import type {
  VisibleEquivalenceInput,
  CutReplayInput,
  LawsOutcome,
} from './interpretation-laws.js';

export type { VisibleEquivalenceInput, CutReplayInput, LawsOutcome };

export interface InterpretationLawsPort {
  proveVisibleEquivalence(input: VisibleEquivalenceInput): Promise<LawsOutcome>;
  replayCuts(input: CutReplayInput): Promise<LawsOutcome>;
}
