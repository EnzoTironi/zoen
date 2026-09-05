import type { InvalidInput } from "@zoen/contracts/d01/errors";
import { QuotaExceeded } from "@zoen/contracts/d01/errors";
import type { VisibleClaim } from "@zoen/contracts/d01/evidence";
import type {
  IdentityComparison,
  IdentityComparisonCell,
  IdentitySegment,
} from "@zoen/contracts/subject-identity/frame";
import { SUBJECT_IDENTITY_LIMITS } from "@zoen/contracts/subject-identity/values";
import { Effect } from "effect";

import { compareAmounts } from "../../../values/amount.js";
import type { IdentityCellDraft } from "./cells.js";
import type { IdentityClosure } from "./graph.js";
import { activeSegments, relationBetween } from "./graph.js";
import { covers } from "./intervals.js";

const identitySupport = (
  cell: IdentityCellDraft,
  segments: readonly IdentitySegment[],
  left: VisibleClaim,
  right: VisibleClaim
): readonly IdentitySegment["assertionRef"][] => {
  if (left.subjectKey === right.subjectKey) {
    return [];
  }
  const members = new Set(
    cell.structure.components
      .filter(
        (component) =>
          component.members.includes(left.subjectKey) ||
          component.members.includes(right.subjectKey)
      )
      .flatMap((component) => component.members)
  );
  return [
    ...new Set(
      segments
        .filter(
          (segment) => members.has(segment.left) && members.has(segment.right)
        )
        .map((segment) => segment.assertionRef)
    ),
  ].toSorted();
};

const comparePair = Effect.fn("subjectIdentity.comparePair")(
  function* comparePair(
    cell: IdentityCellDraft,
    segments: readonly IdentitySegment[],
    left: VisibleClaim,
    right: VisibleClaim
  ): Effect.fn.Return<IdentityComparison, InvalidInput> {
    const relation = relationBetween(
      cell.structure,
      left.subjectKey,
      right.subjectKey
    );
    const pair = {
      identitySupportRefs: identitySupport(cell, segments, left, right),
      interval: cell.structure.interval,
      leftClaimRef: left.claimRef,
      rightClaimRef: right.claimRef,
    };
    if (relation !== "same-as") {
      return {
        ...pair,
        reasons: [
          relation === "different-from"
            ? "different-subjects"
            : "identity-unresolved",
        ],
        status: "not-comparable",
      };
    }
    const unknown: ("unknown-value" | "unknown-period")[] = [];
    if (left.value._tag === "Unknown" || right.value._tag === "Unknown") {
      unknown.push("unknown-value");
    }
    if (
      left.validTime._tag === "Unknown" ||
      right.validTime._tag === "Unknown"
    ) {
      unknown.push("unknown-period");
    }
    if (
      unknown.length > 0 ||
      left.value._tag !== "Known" ||
      right.value._tag !== "Known"
    ) {
      return { ...pair, reasons: unknown, status: "unknown" };
    }
    if (left.predicate !== right.predicate) {
      return {
        ...pair,
        reasons: ["different-predicate"],
        status: "not-comparable",
      };
    }
    const comparison = yield* compareAmounts(
      { amount: left.value.amount, currency: left.value.currency },
      { amount: right.value.amount, currency: right.value.currency }
    );
    if (comparison._tag === "NotComparable") {
      return {
        ...pair,
        reasons: ["incompatible-currency"],
        status: "not-comparable",
      };
    }
    return {
      ...pair,
      reasons: [],
      status: comparison.order === 0 ? "agree" : "conflict",
    };
  }
);

/** Compares every eligible pair; unknown time never becomes known coverage. */
export const compareIdentityCells = Effect.fn(
  "subjectIdentity.compareIdentityCells"
)(function* compareIdentityCells(
  closure: IdentityClosure,
  cells: readonly IdentityCellDraft[],
  claims: readonly VisibleClaim[]
) {
  const result: IdentityComparisonCell[] = [];
  for (const cell of cells) {
    const eligible = claims.filter(
      (claim) =>
        claim.validTime._tag === "Unknown" ||
        covers(claim.validTime, cell.structure.interval)
    );
    const pairCount = (eligible.length * (eligible.length - 1)) / 2;
    if (pairCount > SUBJECT_IDENTITY_LIMITS.comparisonPairsPerCell) {
      return yield* new QuotaExceeded({ code: "QUOTA_EXCEEDED" });
    }
    const comparisons: IdentityComparison[] = [];
    const segments = activeSegments(closure, cell.structure.interval);
    for (const [index, left] of eligible.entries()) {
      for (const right of eligible.slice(index + 1)) {
        comparisons.push(yield* comparePair(cell, segments, left, right));
      }
    }
    result.push({
      ...cell.structure,
      cellRef: cell.cellRef,
      comparisons,
      coveredClaimRefs: cell.coveredClaimRefs,
    });
  }
  return result;
});
