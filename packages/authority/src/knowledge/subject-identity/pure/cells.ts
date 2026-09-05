import { InvalidInput, QuotaExceeded } from "@zoen/contracts/d01/errors";
import { VisibleClaim } from "@zoen/contracts/d01/evidence";
import type { DateInterval } from "@zoen/contracts/d01/values";
import {
  IdentityCellRef,
  SUBJECT_IDENTITY_LIMITS,
} from "@zoen/contracts/subject-identity/values";
import { Effect, Schema } from "effect";

import { canonicalJson, digestBytes } from "../../../values/canonical.js";
import type { IdentityClosure, IdentityStructure } from "./graph.js";
import { structureForCell } from "./graph.js";
import { covers, intervalCells } from "./intervals.js";

type Interval = typeof DateInterval.Type;
export interface IdentityCellDraft {
  readonly cellRef: typeof IdentityCellRef.Type;
  readonly coveredClaimRefs: readonly VisibleClaim["claimRef"][];
  readonly structure: IdentityStructure;
}
interface MergingCell {
  readonly coveredClaimRefs: readonly VisibleClaim["claimRef"][];
  readonly signature: string;
  structure: IdentityStructure;
}
const encoder = new TextEncoder();

export const validateComparisonClaims = Effect.fn(
  "subjectIdentity.validateComparisonClaims"
)(function* validateComparisonClaims(
  closure: IdentityClosure,
  input: readonly VisibleClaim[]
) {
  if (input.length > SUBJECT_IDENTITY_LIMITS.claims) {
    return yield* new QuotaExceeded({ code: "QUOTA_EXCEEDED" });
  }
  const claims = yield* Schema.decodeEffect(Schema.Array(VisibleClaim))(
    input
  ).pipe(Effect.mapError(() => new InvalidInput({ code: "INVALID_INPUT" })));
  if (
    new Set(claims.map((claim) => claim.claimRef)).size !== claims.length ||
    claims.some((claim) => !closure.anchors.includes(claim.subjectKey))
  ) {
    return yield* new InvalidInput({ code: "INVALID_INPUT" });
  }
  return claims.toSorted((left, right) =>
    left.claimRef < right.claimRef ? -1 : 1
  );
});

/** Claims are absent for recovery. Coalescing is mandatory before quota and IDs. */
export const maximalIdentityCells = Effect.fn(
  "subjectIdentity.maximalIdentityCells"
)(function* maximalIdentityCells(
  closure: IdentityClosure,
  interval: Interval,
  claims: readonly VisibleClaim[] = []
) {
  const boundaries = closure.segments.flatMap((segment) => [
    segment.effectiveInterval.from,
    segment.effectiveInterval.to,
  ]);
  for (const claim of claims) {
    if (claim.validTime._tag === "DateInterval") {
      boundaries.push(claim.validTime.from, claim.validTime.to);
    }
  }
  const merged: MergingCell[] = [];
  for (const part of intervalCells(interval, boundaries)) {
    const structure = yield* structureForCell(closure, part);
    const coveredClaimRefs = claims
      .filter(
        (claim) =>
          claim.validTime._tag === "DateInterval" &&
          covers(claim.validTime, part)
      )
      .map((claim) => claim.claimRef)
      .toSorted();
    const signature = yield* canonicalJson({
      activeAssertionRefs: structure.activeAssertionRefs,
      components: structure.components,
      coveredClaimRefs,
      distinctions: structure.distinctions,
    });
    const previous = merged.at(-1);
    if (previous !== undefined && previous.signature === signature) {
      previous.structure = {
        ...previous.structure,
        interval: { ...previous.structure.interval, to: part.to },
      };
    } else {
      merged.push({ coveredClaimRefs, signature, structure });
    }
  }
  if (merged.length > SUBJECT_IDENTITY_LIMITS.cells) {
    return yield* new QuotaExceeded({ code: "QUOTA_EXCEEDED" });
  }
  const cells: IdentityCellDraft[] = [];
  for (const cell of merged) {
    const canonical = yield* canonicalJson({
      interval: cell.structure.interval,
      signature: cell.signature,
    });
    cells.push({
      cellRef: yield* Schema.decodeEffect(IdentityCellRef)(
        digestBytes(
          encoder.encode(`zoen:subject-identity:cell:v1\n${canonical}`)
        )
      ).pipe(
        Effect.mapError(() => new InvalidInput({ code: "INVALID_INPUT" }))
      ),
      coveredClaimRefs: cell.coveredClaimRefs,
      structure: cell.structure,
    });
  }
  return cells;
});
