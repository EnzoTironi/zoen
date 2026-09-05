import {
  Conflict,
  InvalidInput,
  QuotaExceeded,
} from "@zoen/contracts/d01/errors";
import { DateInterval } from "@zoen/contracts/d01/values";
import type { SubjectKey } from "@zoen/contracts/d01/values";
import type {
  IdentityCellStructure,
  IdentitySegment,
} from "@zoen/contracts/subject-identity/frame";
import {
  IdentityAnchors,
  SUBJECT_IDENTITY_LIMITS,
} from "@zoen/contracts/subject-identity/values";
import { Effect, Schema } from "effect";

import type { IdentityProjection } from "./events.js";
import { covers, overlaps } from "./intervals.js";

type Anchor = typeof SubjectKey.Type;
type Interval = typeof DateInterval.Type;
export interface IdentityClosure {
  readonly anchors: readonly Anchor[];
  readonly segments: readonly IdentitySegment[];
}
export type IdentityStructure = Omit<IdentityCellStructure, "cellRef">;

/** Both signs expand the complete authorized region, independent of edge order. */
export const closeIdentity = Effect.fn("subjectIdentity.closeIdentity")(
  function* closeIdentity(
    projection: IdentityProjection,
    seeds: readonly Anchor[],
    interval: Interval
  ): Effect.fn.Return<IdentityClosure, InvalidInput | QuotaExceeded> {
    yield* Schema.decodeEffect(IdentityAnchors)(seeds).pipe(
      Effect.mapError(() => new InvalidInput({ code: "INVALID_INPUT" }))
    );
    yield* Schema.decodeEffect(DateInterval)(interval).pipe(
      Effect.mapError(() => new InvalidInput({ code: "INVALID_INPUT" }))
    );
    const candidates = projection.assertions.flatMap((projected) =>
      projected.effectiveIntervals
        .filter((part) => overlaps(part, interval))
        .map((effectiveInterval): IdentitySegment => ({
          assertionRef: projected.assertion.assertionRef,
          decisionRef: projected.decisionRef,
          effectiveInterval,
          left: projected.assertion.left,
          relation: projected.assertion.relation,
          right: projected.assertion.right,
          withdrawalRefs: projected.withdrawals
            .map((item) => item.effectRef)
            .toSorted(),
        }))
    );
    const anchors = new Set(seeds);
    let changed = true;
    while (changed) {
      changed = false;
      for (const segment of candidates) {
        if (anchors.has(segment.left) || anchors.has(segment.right)) {
          const { size } = anchors;
          anchors.add(segment.left);
          anchors.add(segment.right);
          if (anchors.size > SUBJECT_IDENTITY_LIMITS.anchors) {
            return yield* new QuotaExceeded({ code: "QUOTA_EXCEEDED" });
          }
          changed ||= size !== anchors.size;
        }
      }
    }
    const segments = candidates.filter((segment) => anchors.has(segment.left));
    if (segments.length > SUBJECT_IDENTITY_LIMITS.segments) {
      return yield* new QuotaExceeded({ code: "QUOTA_EXCEEDED" });
    }
    segments.sort((left, right) => {
      const first = `${left.assertionRef}:${left.effectiveInterval.from}`;
      const second = `${right.assertionRef}:${right.effectiveInterval.from}`;
      if (first === second) {
        return 0;
      }
      return first < second ? -1 : 1;
    });
    return { anchors: [...anchors].toSorted(), segments };
  }
);

export const activeSegments = (
  closure: IdentityClosure,
  interval: Interval
): readonly IdentitySegment[] =>
  closure.segments.filter((segment) =>
    covers(segment.effectiveInterval, interval)
  );

const positiveComponents = Effect.fn("subjectIdentity.positiveComponents")(
  function* positiveComponents(
    closure: IdentityClosure,
    active: readonly IdentitySegment[]
  ) {
    const adjacency = new Map<Anchor, Set<Anchor>>(
      closure.anchors.map((anchor) => [anchor, new Set<Anchor>()])
    );
    for (const segment of active) {
      if (segment.relation === "same-as") {
        adjacency.get(segment.left)?.add(segment.right);
        adjacency.get(segment.right)?.add(segment.left);
      }
    }
    const representatives = new Map<Anchor, Anchor>();
    const components: IdentityStructure["components"][number][] = [];
    for (const anchor of closure.anchors) {
      if (representatives.has(anchor)) {
        continue;
      }
      const members = new Set<Anchor>([anchor]);
      for (const member of members) {
        for (const neighbor of adjacency.get(member) ?? []) {
          members.add(neighbor);
        }
      }
      const sorted = [...members].toSorted();
      const [representative] = sorted;
      if (representative === undefined) {
        return yield* new InvalidInput({ code: "INVALID_INPUT" });
      }
      components.push({ members: sorted, representative });
      for (const member of sorted) {
        representatives.set(member, representative);
      }
    }
    return { components, representatives };
  }
);

/** Called for a constant-graph interval produced from every segment boundary. */
export const structureForCell = Effect.fn("subjectIdentity.structureForCell")(
  function* structureForCell(
    closure: IdentityClosure,
    interval: Interval
  ): Effect.fn.Return<IdentityStructure, Conflict | InvalidInput> {
    if (
      closure.segments.some(
        (segment) =>
          overlaps(segment.effectiveInterval, interval) &&
          !covers(segment.effectiveInterval, interval)
      )
    ) {
      return yield* new InvalidInput({ code: "INVALID_INPUT" });
    }
    const active = activeSegments(closure, interval);
    const { components, representatives } = yield* positiveComponents(
      closure,
      active
    );
    const distinctions = new Map<
      string,
      {
        assertionRefs: IdentitySegment["assertionRef"][];
        leftComponent: Anchor;
        rightComponent: Anchor;
      }
    >();
    for (const segment of active) {
      if (segment.relation !== "different-from") {
        continue;
      }
      const left = representatives.get(segment.left);
      const right = representatives.get(segment.right);
      if (left === undefined || right === undefined) {
        return yield* new InvalidInput({ code: "INVALID_INPUT" });
      }
      if (left === right) {
        return yield* new Conflict({ code: "CONFLICT" });
      }
      const leftComponent = left < right ? left : right;
      const rightComponent = left < right ? right : left;
      const key = `${leftComponent}/${rightComponent}`;
      const existing = distinctions.get(key);
      if (existing === undefined) {
        distinctions.set(key, {
          assertionRefs: [segment.assertionRef],
          leftComponent,
          rightComponent,
        });
      } else {
        existing.assertionRefs.push(segment.assertionRef);
      }
    }
    return {
      activeAssertionRefs: [
        ...new Set(active.map((item) => item.assertionRef)),
      ].toSorted(),
      components,
      distinctions: [...distinctions.entries()]
        .toSorted(([left], [right]) => (left < right ? -1 : 1))
        .map(([, item]) => ({
          ...item,
          assertionRefs: item.assertionRefs.toSorted(),
        })),
      interval,
    };
  }
);

export const relationBetween = (
  cell: IdentityStructure,
  left: Anchor,
  right: Anchor
): "same-as" | "different-from" | "unresolved" => {
  const leftComponent = cell.components.find((item) =>
    item.members.includes(left)
  );
  const rightComponent = cell.components.find((item) =>
    item.members.includes(right)
  );
  if (leftComponent === undefined || rightComponent === undefined) {
    return "unresolved";
  }
  if (leftComponent.representative === rightComponent.representative) {
    return "same-as";
  }
  return cell.distinctions.some(
    (item) =>
      (item.leftComponent === leftComponent.representative &&
        item.rightComponent === rightComponent.representative) ||
      (item.leftComponent === rightComponent.representative &&
        item.rightComponent === leftComponent.representative)
  )
    ? "different-from"
    : "unresolved";
};
