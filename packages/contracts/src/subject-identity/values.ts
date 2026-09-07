import { Schema } from "effect";

import { WorldLimits, Digest, SubjectKey } from "../worlds/values.js";

export const SUBJECT_IDENTITY_LIMITS = {
  anchors: 32,
  cells: 64,
  claims: WorldLimits.frameClaims,
  comparisonPairsPerCell: 256,
  effectItems: 512,
  segments: 128,
} as const;

export const SubjectIdentityVersion = Schema.Literal("subject-identity.v1");
export const IdentityDecisionRef = Schema.String.check(Schema.isUUID()).pipe(
  Schema.brand("zoen/IdentityDecisionRef")
);
export const IdentityAssertionRef = Schema.String.check(Schema.isUUID()).pipe(
  Schema.brand("zoen/IdentityAssertionRef")
);
export const IdentityEffectRef = Schema.String.check(Schema.isUUID()).pipe(
  Schema.brand("zoen/IdentityEffectRef")
);
export const IdentityCellRef = Digest.pipe(
  Schema.brand("zoen/IdentityCellRef")
);
export const IdentityRelation = Schema.Literals(["same-as", "different-from"]);
export const IdentityAnswer = Schema.Literals([
  "same-as",
  "different-from",
  "confirm",
  "unknown",
]);
export const IdentityAnchors = Schema.Array(SubjectKey).check(
  Schema.isMinLength(1),
  Schema.isMaxLength(SUBJECT_IDENTITY_LIMITS.anchors),
  Schema.makeFilter((values) => new Set(values).size === values.length)
);
export const IdentitySeeds = Schema.Array(SubjectKey).check(
  Schema.isMinLength(1),
  Schema.isMaxLength(2),
  Schema.makeFilter((values) => new Set(values).size === values.length)
);
