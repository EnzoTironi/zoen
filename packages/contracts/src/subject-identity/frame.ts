import { Schema } from "effect";

import { VisibleClaim } from "../d01/evidence.js";
import {
  ClaimRef,
  DateInterval,
  FrameRef,
  Purpose,
  SubjectKey,
  WorldRef,
  exact,
} from "../d01/values.js";
import {
  IdentityAnchors,
  IdentityAssertionRef,
  IdentityCellRef,
  IdentityDecisionRef,
  IdentityEffectRef,
  IdentityRelation,
  IdentitySeeds,
  SUBJECT_IDENTITY_LIMITS,
  SubjectIdentityVersion,
} from "./values.js";

const assertionRefs = Schema.Array(IdentityAssertionRef).check(
  Schema.isMaxLength(SUBJECT_IDENTITY_LIMITS.segments)
);
export const IdentitySegment = Schema.Struct({
  assertionRef: IdentityAssertionRef,
  decisionRef: IdentityDecisionRef,
  effectiveInterval: DateInterval,
  left: SubjectKey,
  relation: IdentityRelation,
  right: SubjectKey,
  withdrawalRefs: Schema.Array(IdentityEffectRef).check(
    Schema.isMaxLength(SUBJECT_IDENTITY_LIMITS.effectItems)
  ),
})
  .check(Schema.makeFilter((value) => value.left < value.right))
  .annotate(exact);
export type IdentitySegment = typeof IdentitySegment.Type;
export const IdentityComponent = Schema.Struct({
  members: IdentityAnchors,
  representative: SubjectKey,
})
  .check(
    Schema.makeFilter(
      (value) => value.members.toSorted()[0] === value.representative
    )
  )
  .annotate(exact);
export const IdentityDistinction = Schema.Struct({
  assertionRefs: assertionRefs.check(Schema.isMinLength(1)),
  leftComponent: SubjectKey,
  rightComponent: SubjectKey,
})
  .check(
    Schema.makeFilter((value) => value.leftComponent < value.rightComponent)
  )
  .annotate(exact);
export const IdentityCellStructure = Schema.Struct({
  activeAssertionRefs: assertionRefs,
  cellRef: IdentityCellRef,
  components: Schema.Array(IdentityComponent).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(SUBJECT_IDENTITY_LIMITS.anchors),
    Schema.makeFilter((components) => {
      const members = components.flatMap((component) => component.members);
      return (
        members.length <= SUBJECT_IDENTITY_LIMITS.anchors &&
        new Set(members).size === members.length
      );
    })
  ),
  distinctions: Schema.Array(IdentityDistinction).check(
    Schema.isMaxLength(SUBJECT_IDENTITY_LIMITS.segments)
  ),
  interval: DateInterval,
}).annotate(exact);
export type IdentityCellStructure = typeof IdentityCellStructure.Type;

const comparison = {
  identitySupportRefs: assertionRefs,
  interval: DateInterval,
  leftClaimRef: ClaimRef,
  rightClaimRef: ClaimRef,
};
export const IdentityComparison = Schema.Union([
  Schema.Struct({
    ...comparison,
    reasons: Schema.Tuple([]),
    status: Schema.Literals(["agree", "conflict"]),
  }).annotate(exact),
  Schema.Struct({
    ...comparison,
    reasons: Schema.Array(
      Schema.Literals([
        "identity-unresolved",
        "different-subjects",
        "different-predicate",
        "incompatible-currency",
      ])
    ).check(Schema.isMinLength(1), Schema.isMaxLength(4)),
    status: Schema.Literal("not-comparable"),
  }).annotate(exact),
  Schema.Struct({
    ...comparison,
    reasons: Schema.Array(
      Schema.Literals(["unknown-value", "unknown-period"])
    ).check(Schema.isMinLength(1), Schema.isMaxLength(2)),
    status: Schema.Literal("unknown"),
  }).annotate(exact),
]);
export type IdentityComparison = typeof IdentityComparison.Type;
export const IdentityComparisonCell = Schema.Struct({
  ...IdentityCellStructure.fields,
  coveredClaimRefs: Schema.Array(ClaimRef).check(
    Schema.isMaxLength(SUBJECT_IDENTITY_LIMITS.claims),
    Schema.makeFilter((refs) => new Set(refs).size === refs.length)
  ),
  comparisons: Schema.Array(IdentityComparison).check(
    Schema.isMaxLength(SUBJECT_IDENTITY_LIMITS.comparisonPairsPerCell)
  ),
}).annotate(exact);
export type IdentityComparisonCell = typeof IdentityComparisonCell.Type;
export const IdentityStructureCells = Schema.Array(IdentityCellStructure).check(
  Schema.isMinLength(1),
  Schema.isMaxLength(SUBJECT_IDENTITY_LIMITS.cells)
);
export const IdentityComparisonCells = Schema.Array(
  IdentityComparisonCell
).check(
  Schema.isMinLength(1),
  Schema.isMaxLength(SUBJECT_IDENTITY_LIMITS.cells)
);
const frame = {
  assertionSegments: Schema.Array(IdentitySegment).check(
    Schema.isMaxLength(SUBJECT_IDENTITY_LIMITS.segments)
  ),
  audience: Schema.Literal("private-author"),
  closureAnchors: IdentityAnchors,
  frameRef: FrameRef,
  interval: DateInterval,
  purpose: Purpose,
  schemaVersion: SubjectIdentityVersion,
  worldRef: WorldRef,
};
export const IdentityFrame = Schema.Struct({
  ...frame,
  cells: IdentityComparisonCells,
  claims: Schema.Array(VisibleClaim).check(
    Schema.isMaxLength(SUBJECT_IDENTITY_LIMITS.claims)
  ),
  kind: Schema.Literal("subject-identity"),
  requestedAnchors: IdentitySeeds,
}).annotate(exact);
export type IdentityFrame = typeof IdentityFrame.Type;
export const IdentityRecoveryFrame = Schema.Struct({
  ...frame,
  anchor: SubjectKey,
  cells: IdentityStructureCells,
  comparison: Schema.Literal("not-requested"),
  kind: Schema.Literal("subject-identity-recovery"),
  targetDecisionRef: Schema.NullOr(IdentityDecisionRef),
}).annotate(exact);
export type IdentityRecoveryFrame = typeof IdentityRecoveryFrame.Type;
export const IdentityFramePointer = Schema.Struct({
  frameRef: FrameRef,
  kind: Schema.Literal("subject-identity"),
}).annotate(exact);
export const IdentityRecoveryFramePointer = Schema.Struct({
  frameRef: FrameRef,
  kind: Schema.Literal("subject-identity-recovery"),
}).annotate(exact);
export const IdentityControlFramePointer = Schema.Union([
  IdentityFramePointer,
  IdentityRecoveryFramePointer,
]);
