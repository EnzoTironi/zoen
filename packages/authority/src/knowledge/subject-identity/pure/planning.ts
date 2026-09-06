import { InvalidInput, QuotaExceeded, Stale } from "@zoen/contracts/d01/errors";
import type { DateInterval, SubjectKey } from "@zoen/contracts/d01/values";
import { IdentityEffects } from "@zoen/contracts/subject-identity/effects";
import type { IdentityEffect } from "@zoen/contracts/subject-identity/effects";
import type {
  IdentityFrame,
  IdentityRecoveryFrame,
} from "@zoen/contracts/subject-identity/frame";
import type {
  IdentityBlockedReason,
  IdentityPartitions,
} from "@zoen/contracts/subject-identity/question";
import { SUBJECT_IDENTITY_LIMITS } from "@zoen/contracts/subject-identity/values";
import { Effect, Schema } from "effect";

import { canonicalJson } from "../../../values/canonical.js";
import type { IdentityProjection } from "./events.js";
import { closeIdentity, relationBetween } from "./graph.js";
import { covers, subtractIntervals, unionIntervals } from "./intervals.js";

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

const blockedPlan = (
  reason: typeof IdentityBlockedReason.Type,
  supportingRefs: BlockedIdentityPlan["supportingRefs"] = []
): IdentityEffectPlan => ({
  _tag: "Blocked",
  blocked: {
    reason,
    supportingRefs: [...new Set(supportingRefs)].toSorted(),
  },
});

const componentOf = (
  cell: IdentityControlFrame["cells"][number],
  anchor: typeof SubjectKey.Type
) => cell.components.find((component) => component.members.includes(anchor));

const connectedWithin = (
  members: readonly (typeof SubjectKey.Type)[],
  edges: readonly {
    readonly left: typeof SubjectKey.Type;
    readonly right: typeof SubjectKey.Type;
  }[]
): boolean => {
  if (members.length <= 1) {
    return true;
  }
  const allowed = new Set(members);
  const adjacency = new Map(
    members.map((member) => [member, new Set<typeof SubjectKey.Type>()])
  );
  for (const edge of edges) {
    if (allowed.has(edge.left) && allowed.has(edge.right)) {
      adjacency.get(edge.left)?.add(edge.right);
      adjacency.get(edge.right)?.add(edge.left);
    }
  }
  const [start] = members;
  if (start === undefined) {
    return false;
  }
  const seen = new Set<typeof SubjectKey.Type>([start]);
  for (const member of seen) {
    for (const neighbor of adjacency.get(member) ?? []) {
      seen.add(neighbor);
    }
  }
  return seen.size === members.length;
};

const coalesceDrafts = (
  drafts: readonly IdentityEffectDraft[]
): IdentityEffectDraft[] => {
  type WithdrawDraft = Extract<
    IdentityEffectDraft,
    { readonly _tag: "Withdraw" }
  >;
  type AssertDraft = Extract<IdentityEffectDraft, { readonly _tag: "Assert" }>;
  const withdrawals = new Map<
    WithdrawDraft["assertionRef"],
    (typeof DateInterval.Type)[]
  >();
  const asserts = new Map<
    string,
    {
      readonly left: AssertDraft["left"];
      readonly relation: AssertDraft["relation"];
      readonly right: AssertDraft["right"];
      readonly intervals: (typeof DateInterval.Type)[];
    }
  >();
  for (const draft of drafts) {
    if (draft._tag === "Withdraw") {
      const existing = withdrawals.get(draft.assertionRef) ?? [];
      existing.push(draft.interval);
      withdrawals.set(draft.assertionRef, existing);
    } else if (draft._tag === "Assert") {
      const key = `${draft.relation}:${draft.left}:${draft.right}`;
      const existing = asserts.get(key);
      if (existing === undefined) {
        asserts.set(key, {
          intervals: [draft.interval],
          left: draft.left,
          relation: draft.relation,
          right: draft.right,
        });
      } else {
        existing.intervals.push(draft.interval);
      }
    }
  }
  const result: IdentityEffectDraft[] = [];
  for (const assertionRef of [...withdrawals.keys()].toSorted()) {
    for (const interval of unionIntervals(
      withdrawals.get(assertionRef) ?? []
    )) {
      result.push({ _tag: "Withdraw", assertionRef, interval });
    }
  }
  for (const key of [...asserts.keys()].toSorted()) {
    const item = asserts.get(key);
    if (item === undefined) {
      continue;
    }
    for (const interval of unionIntervals(item.intervals)) {
      result.push({
        _tag: "Assert",
        interval,
        left: item.left,
        relation: item.relation,
        right: item.right,
      });
    }
  }
  return result;
};

/** Explicit full-component partition; never invents intra-block equality. */
export const planSplitEffects = Effect.fn("subjectIdentity.planSplitEffects")(
  function* planSplitEffects(
    projection: IdentityProjection,
    frame: IdentityControlFrame,
    anchor: typeof SubjectKey.Type,
    partitionsByCell: IdentityPartitions
  ) {
    yield* currentPlanningClosure(projection, frame);
    if (!frame.closureAnchors.includes(anchor)) {
      return yield* new InvalidInput({ code: "INVALID_INPUT" });
    }
    if (partitionsByCell.length !== frame.cells.length) {
      return blockedPlan("InvalidPartition");
    }
    const byCell = new Map(
      partitionsByCell.map((partition) => [partition.cellRef, partition])
    );
    if (byCell.size !== frame.cells.length) {
      return blockedPlan("InvalidPartition");
    }
    const drafts: IdentityEffectDraft[] = [];
    const supporting: BlockedIdentityPlan["supportingRefs"] = [];
    let separated = false;
    for (const cell of frame.cells) {
      const partition = byCell.get(cell.cellRef);
      if (partition === undefined) {
        return blockedPlan("InvalidPartition");
      }
      const component = componentOf(cell, anchor);
      if (component === undefined) {
        return yield* new InvalidInput({ code: "INVALID_INPUT" });
      }
      const members = component.members;
      const flat = partition.blocks.flat();
      if (
        partition.blocks.length === 0 ||
        flat.length !== members.length ||
        new Set(flat).size !== flat.length ||
        flat.some((member) => !members.includes(member))
      ) {
        return blockedPlan(
          "InvalidPartition",
          cell.activeAssertionRefs.slice()
        );
      }
      if (partition.blocks.length > 1) {
        separated = true;
      }
      const blockOf = new Map<typeof SubjectKey.Type, number>();
      for (const [index, block] of partition.blocks.entries()) {
        for (const member of block) {
          blockOf.set(member, index);
        }
      }
      const activeSameAs = frame.assertionSegments.filter(
        (segment) =>
          segment.relation === "same-as" &&
          members.includes(segment.left) &&
          members.includes(segment.right) &&
          covers(segment.effectiveInterval, cell.interval)
      );
      const remaining: {
        readonly left: typeof SubjectKey.Type;
        readonly right: typeof SubjectKey.Type;
      }[] = [];
      for (const segment of activeSameAs) {
        const leftBlock = blockOf.get(segment.left);
        const rightBlock = blockOf.get(segment.right);
        if (leftBlock === undefined || rightBlock === undefined) {
          continue;
        }
        if (leftBlock === rightBlock) {
          remaining.push({ left: segment.left, right: segment.right });
        } else {
          supporting.push(segment.assertionRef);
          drafts.push({
            _tag: "Withdraw",
            assertionRef: segment.assertionRef,
            interval: cell.interval,
          });
        }
      }
      for (const block of partition.blocks) {
        if (!connectedWithin(block, remaining)) {
          return blockedPlan(
            "InvalidPartition",
            cell.activeAssertionRefs.slice()
          );
        }
      }
      for (
        let leftIndex = 0;
        leftIndex < partition.blocks.length;
        leftIndex++
      ) {
        const leftBlock = partition.blocks[leftIndex];
        if (leftBlock === undefined) {
          continue;
        }
        for (
          let rightIndex = leftIndex + 1;
          rightIndex < partition.blocks.length;
          rightIndex++
        ) {
          const rightBlock = partition.blocks[rightIndex];
          if (rightBlock === undefined) {
            continue;
          }
          for (const left of leftBlock) {
            for (const right of rightBlock) {
              const orderedLeft = left < right ? left : right;
              const orderedRight = left < right ? right : left;
              drafts.push({
                _tag: "Assert",
                interval: cell.interval,
                left: orderedLeft,
                relation: "different-from",
                right: orderedRight,
              });
            }
          }
        }
      }
    }
    if (!separated) {
      return blockedPlan("InvalidPartition", supporting);
    }
    const effectItems = coalesceDrafts(drafts);
    if (effectItems.length === 0) {
      return blockedPlan("InvalidPartition", supporting);
    }
    if (effectItems.length > SUBJECT_IDENTITY_LIMITS.effectItems) {
      return blockedPlan("QuotaExceeded", supporting);
    }
    return { _tag: "Allowed" as const, effectItems };
  }
);
