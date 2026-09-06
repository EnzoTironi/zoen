import { InvalidInput, QuotaExceeded, Stale } from "@zoen/contracts/d01/errors";
import type { DateInterval, SubjectKey } from "@zoen/contracts/d01/values";
import { IdentityEffects } from "@zoen/contracts/subject-identity/effects";
import type { IdentityEffect } from "@zoen/contracts/subject-identity/effects";
import type {
  IdentityFrame,
  IdentityRecoveryFrame,
} from "@zoen/contracts/subject-identity/frame";
import type { IdentityBlockedReason } from "@zoen/contracts/subject-identity/question";
import { SUBJECT_IDENTITY_LIMITS } from "@zoen/contracts/subject-identity/values";
import { Effect, Schema } from "effect";

import { canonicalJson } from "../../../values/canonical.js";
import type { IdentityProjection } from "./events.js";
import { closeIdentity, relationBetween } from "./graph.js";
import { subtractIntervals, unionIntervals } from "./intervals.js";

export type IdentityControlFrame = IdentityFrame | IdentityRecoveryFrame;
export type IdentityEffectDraft =
  | Omit<
      Extract<IdentityEffect, { readonly _tag: "Assert" }>,
      "assertionRef" | "effectRef"
    >
  | Omit<Extract<IdentityEffect, { readonly _tag: "Withdraw" }>, "effectRef">
  | Omit<Extract<IdentityEffect, { readonly _tag: "UndoEffect" }>, "effectRef">;
export interface IdentityEffectAllocation {
  readonly effectRef: IdentityEffect["effectRef"];
  readonly assertionRef:
    | Extract<IdentityEffect, { readonly _tag: "Assert" }>["assertionRef"]
    | null;
}
export interface BlockedIdentityPlan {
  readonly reason: typeof IdentityBlockedReason.Type;
  readonly supportingRefs: IdentityFrame["assertionSegments"][number]["assertionRef"][];
}
export type IdentityEffectPlan =
  | {
      readonly _tag: "Allowed";
      readonly effectItems: readonly IdentityEffectDraft[];
    }
  | { readonly _tag: "Blocked"; readonly blocked: BlockedIdentityPlan };

/** Detects graph drift only; the caller must also validate the complete retained basis. */
export const currentPlanningClosure = Effect.fn(
  "subjectIdentity.currentPlanningClosure"
)(function* currentPlanningClosure(
  projection: IdentityProjection,
  frame: IdentityControlFrame
) {
  const closure = yield* closeIdentity(
    projection,
    frame.closureAnchors,
    frame.interval
  );
  const actual = yield* canonicalJson(closure);
  const retained = yield* canonicalJson({
    anchors: frame.closureAnchors,
    segments: frame.assertionSegments,
  });
  if (actual !== retained) {
    return yield* new Stale({ code: "STALE" });
  }
  return closure;
});

/** IDs are issued outside this pure module, then become part of the exact preview. */
export const bindIdentityEffectIds = Effect.fn(
  "subjectIdentity.bindIdentityEffectIds"
)(function* bindIdentityEffectIds(
  drafts: readonly IdentityEffectDraft[],
  ids: readonly IdentityEffectAllocation[]
) {
  if (drafts.length > SUBJECT_IDENTITY_LIMITS.effectItems) {
    return yield* new QuotaExceeded({ code: "QUOTA_EXCEEDED" });
  }
  if (drafts.length !== ids.length) {
    return yield* new InvalidInput({ code: "INVALID_INPUT" });
  }
  const result: unknown[] = [];
  for (const [index, draft] of drafts.entries()) {
    const allocated = ids[index];
    if (
      allocated === undefined ||
      (draft._tag === "Assert") !== (allocated.assertionRef !== null)
    ) {
      return yield* new InvalidInput({ code: "INVALID_INPUT" });
    }
    result.push(
      draft._tag === "Assert"
        ? {
            ...draft,
            assertionRef: allocated.assertionRef,
            effectRef: allocated.effectRef,
          }
        : { ...draft, effectRef: allocated.effectRef }
    );
  }
  return yield* Schema.decodeUnknownEffect(IdentityEffects)(result).pipe(
    Effect.mapError(() => new InvalidInput({ code: "INVALID_INPUT" }))
  );
});

const directGaps = (
  frame: IdentityFrame,
  left: typeof SubjectKey.Type,
  right: typeof SubjectKey.Type,
  relation: "same-as" | "different-from"
): readonly (typeof DateInterval.Type)[] =>
  subtractIntervals(
    frame.interval,
    unionIntervals(
      frame.assertionSegments
        .filter(
          (segment) =>
            segment.left === left &&
            segment.right === right &&
            segment.relation === relation
        )
        .map((segment) => segment.effectiveInterval)
    )
  );

export const planResolutionEffects = Effect.fn(
  "subjectIdentity.planResolutionEffects"
)(function* planResolutionEffects(
  projection: IdentityProjection,
  frame: IdentityFrame,
  first: typeof SubjectKey.Type,
  second: typeof SubjectKey.Type
) {
  yield* currentPlanningClosure(projection, frame);
  if (
    first === second ||
    !frame.closureAnchors.includes(first) ||
    !frame.closureAnchors.includes(second)
  ) {
    return yield* new InvalidInput({ code: "INVALID_INPUT" });
  }
  const left = first < second ? first : second;
  const right = first < second ? second : first;
  const result: Record<"same-as" | "different-from", IdentityEffectPlan> = {
    "same-as": { _tag: "Allowed", effectItems: [] },
    "different-from": { _tag: "Allowed", effectItems: [] },
  };
  for (const relation of ["same-as", "different-from"] as const) {
    const incompatible = frame.cells.filter((cell) => {
      const current = relationBetween(cell, left, right);
      return relation === "same-as"
        ? current === "different-from"
        : current === "same-as";
    });
    if (incompatible.length > 0) {
      result[relation] = {
        _tag: "Blocked",
        blocked: {
          reason:
            relation === "same-as"
              ? "ConflictingDistinction"
              : "RequiresPartition",
          supportingRefs: [
            ...new Set(
              incompatible.flatMap((cell) => cell.activeAssertionRefs)
            ),
          ].toSorted(),
        },
      };
    } else {
      result[relation] = {
        _tag: "Allowed",
        effectItems: directGaps(frame, left, right, relation).map(
          (interval) => ({
            _tag: "Assert",
            interval,
            left,
            relation,
            right,
          })
        ),
      };
    }
  }
  return result;
});
