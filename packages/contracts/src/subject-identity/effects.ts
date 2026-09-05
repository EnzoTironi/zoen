import { Schema } from "effect";

import { DateInterval, SubjectKey, exact } from "../d01/values.js";
import {
  IdentityAssertionRef,
  IdentityEffectRef,
  IdentityRelation,
  SUBJECT_IDENTITY_LIMITS,
} from "./values.js";

export const AssertIdentity = Schema.TaggedStruct("Assert", {
  assertionRef: IdentityAssertionRef,
  effectRef: IdentityEffectRef,
  interval: DateInterval,
  left: SubjectKey,
  relation: IdentityRelation,
  right: SubjectKey,
})
  .check(Schema.makeFilter((value) => value.left < value.right))
  .annotate(exact);
export const WithdrawIdentity = Schema.TaggedStruct("Withdraw", {
  assertionRef: IdentityAssertionRef,
  effectRef: IdentityEffectRef,
  interval: DateInterval,
}).annotate(exact);
export const UndoIdentityEffect = Schema.TaggedStruct("UndoEffect", {
  effectRef: IdentityEffectRef,
  targetEffectRef: IdentityEffectRef,
})
  .check(
    Schema.makeFilter((value) => value.effectRef !== value.targetEffectRef)
  )
  .annotate(exact);
export const IdentityEffect = Schema.Union([
  AssertIdentity,
  WithdrawIdentity,
  UndoIdentityEffect,
]);
export type IdentityEffect = typeof IdentityEffect.Type;
export const IdentityEffects = Schema.Array(IdentityEffect).check(
  Schema.isMaxLength(SUBJECT_IDENTITY_LIMITS.effectItems),
  Schema.makeFilter(
    (items) =>
      new Set(items.map((item) => item.effectRef)).size === items.length
  )
);
