import { Schema } from "effect";

import {
  CaseRef,
  DateInterval,
  Digest,
  Purpose,
  QuestionRef,
  SubjectKey,
  WorldRef,
  exact,
} from "../d01/values.js";
import { IdentityEffects } from "./effects.js";
import {
  IdentityComparisonCells,
  IdentityFramePointer,
  IdentityRecoveryFramePointer,
  IdentityStructureCells,
} from "./frame.js";
import {
  IdentityAnchors,
  IdentityAssertionRef,
  IdentityCellRef,
  IdentityDecisionRef,
  SUBJECT_IDENTITY_LIMITS,
  SubjectIdentityVersion,
} from "./values.js";

export const IdentityCellPartition = Schema.Struct({
  blocks: Schema.Array(IdentityAnchors).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(SUBJECT_IDENTITY_LIMITS.anchors),
    Schema.makeFilter((blocks) => {
      const members = blocks.flat();
      return (
        members.length <= SUBJECT_IDENTITY_LIMITS.anchors &&
        new Set(members).size === members.length
      );
    })
  ),
  cellRef: IdentityCellRef,
}).annotate(exact);
export const IdentityPartitions = Schema.Array(IdentityCellPartition).check(
  Schema.isMinLength(1),
  Schema.isMaxLength(SUBJECT_IDENTITY_LIMITS.cells),
  Schema.makeFilter(
    (cells) => new Set(cells.map((cell) => cell.cellRef)).size === cells.length
  )
);
export type IdentityPartitions = typeof IdentityPartitions.Type;
export const IdentityImpact = Schema.Struct({
  appliedCorrections: Schema.Literal("preserved-per-literal-anchor"),
  audience: Schema.Literal("private-author"),
  futureClaims: Schema.Literal("identity-applies-within-interval"),
  historicalFrames: Schema.Literal("preserved"),
  pendingCases: Schema.Literals([
    "invalidated-by-identity-change",
    "unchanged",
  ]),
}).annotate(exact);
const alternative = { effectItems: IdentityEffects, impact: IdentityImpact };
const normalAlternative = {
  ...alternative,
  afterCells: IdentityComparisonCells,
};
const recoveryAlternative = {
  ...alternative,
  afterCells: IdentityStructureCells,
  comparison: Schema.Literal("not-requested"),
};
const unchangedImpact = Schema.Struct({
  ...IdentityImpact.fields,
  pendingCases: Schema.Literal("unchanged"),
}).annotate(exact);
const normalUnknown = Schema.Struct({
  ...normalAlternative,
  answer: Schema.Literal("unknown"),
  effectItems: Schema.Tuple([]),
  impact: unchangedImpact,
}).annotate(exact);
const recoveryUnknown = Schema.Struct({
  ...recoveryAlternative,
  answer: Schema.Literal("unknown"),
  effectItems: Schema.Tuple([]),
  impact: unchangedImpact,
}).annotate(exact);
export const IdentityResolutionAlternative = Schema.Union([
  Schema.Struct({
    ...normalAlternative,
    answer: Schema.Literals(["same-as", "different-from"]),
  }).annotate(exact),
  normalUnknown,
]);
export const IdentityControlAlternative = Schema.Union([
  Schema.Struct({
    ...normalAlternative,
    answer: Schema.Literal("confirm"),
  }).annotate(exact),
  normalUnknown,
]);
export const IdentityRecoveryAlternative = Schema.Union([
  Schema.Struct({
    ...recoveryAlternative,
    answer: Schema.Literal("confirm"),
  }).annotate(exact),
  recoveryUnknown,
]);
export const IdentityBlockedReason = Schema.Literals([
  "ConflictingDistinction",
  "RequiresPartition",
  "InvalidPartition",
  "QuotaExceeded",
]);
const blocked = {
  reason: IdentityBlockedReason,
  supportingRefs: Schema.Array(IdentityAssertionRef).check(
    Schema.isMaxLength(SUBJECT_IDENTITY_LIMITS.segments)
  ),
};
const resolutionBlocked = Schema.Struct({
  ...blocked,
  answer: Schema.Literals(["same-as", "different-from"]),
}).annotate(exact);
const controlBlocked = Schema.Struct({
  ...blocked,
  answer: Schema.Literal("confirm"),
}).annotate(exact);
const question = {
  audience: Schema.Literal("private-author"),
  caseRef: CaseRef,
  consequenceDigest: Digest,
  interval: DateInterval,
  purpose: Purpose,
  questionRef: QuestionRef,
  schemaVersion: SubjectIdentityVersion,
  worldRef: WorldRef,
};
export const IdentityResolutionQuestion = Schema.Struct({
  ...question,
  alternatives: Schema.Array(IdentityResolutionAlternative).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(3)
  ),
  blockedAlternatives: Schema.Array(resolutionBlocked).check(
    Schema.isMaxLength(2)
  ),
  frame: IdentityFramePointer,
  intent: Schema.Struct({ left: SubjectKey, right: SubjectKey })
    .check(Schema.makeFilter((value) => value.left < value.right))
    .annotate(exact),
  kind: Schema.Literal("identity-resolution"),
}).annotate(exact);
const splitIntent = Schema.Struct({
  anchor: SubjectKey,
  partitionsByCell: IdentityPartitions,
}).annotate(exact);
const undoIntent = Schema.Struct({
  targetDecisionRef: IdentityDecisionRef,
}).annotate(exact);
const controlQuestion = {
  ...question,
  alternatives: Schema.Array(IdentityControlAlternative).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(2)
  ),
  blockedAlternatives: Schema.Array(controlBlocked).check(
    Schema.isMaxLength(1)
  ),
  frame: IdentityFramePointer,
};
const recoveryQuestion = {
  ...question,
  alternatives: Schema.Array(IdentityRecoveryAlternative).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(2)
  ),
  blockedAlternatives: Schema.Array(controlBlocked).check(
    Schema.isMaxLength(1)
  ),
  comparison: Schema.Literal("not-requested"),
  frame: IdentityRecoveryFramePointer,
};
export const IdentitySplitQuestion = Schema.Struct({
  ...controlQuestion,
  intent: splitIntent,
  kind: Schema.Literal("identity-split"),
}).annotate(exact);
export const IdentityUndoQuestion = Schema.Struct({
  ...controlQuestion,
  intent: undoIntent,
  kind: Schema.Literal("identity-undo"),
}).annotate(exact);
export const IdentityRecoverySplitQuestion = Schema.Struct({
  ...recoveryQuestion,
  intent: splitIntent,
  kind: Schema.Literal("identity-recovery-split"),
}).annotate(exact);
export const IdentityRecoveryUndoQuestion = Schema.Struct({
  ...recoveryQuestion,
  intent: undoIntent,
  kind: Schema.Literal("identity-recovery-undo"),
}).annotate(exact);
export const IdentityQuestion = Schema.Union([
  IdentityResolutionQuestion,
  IdentitySplitQuestion,
  IdentityUndoQuestion,
  IdentityRecoverySplitQuestion,
  IdentityRecoveryUndoQuestion,
]).check(
  Schema.makeFilter((value) => {
    const allowed = value.alternatives.map((item) => item.answer);
    const blockedAnswers = value.blockedAlternatives.map((item) => item.answer);
    return (
      allowed.includes("unknown") &&
      allowed.length + blockedAnswers.length ===
        (value.kind === "identity-resolution" ? 3 : 2) &&
      new Set([...allowed, ...blockedAnswers]).size ===
        allowed.length + blockedAnswers.length
    );
  })
);
export type IdentityQuestion = typeof IdentityQuestion.Type;
