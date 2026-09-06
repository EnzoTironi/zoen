import { describe, expect, it } from "@effect/vitest";
import { SubjectKey } from "@zoen/contracts/d01/values";
import { IdentityFrame } from "@zoen/contracts/subject-identity/frame";
import { Effect, Schema } from "effect";

import { maximalIdentityCells } from "../../../src/knowledge/subject-identity/pure/cells.js";
import { projectIdentity } from "../../../src/knowledge/subject-identity/pure/events.js";
import { closeIdentity } from "../../../src/knowledge/subject-identity/pure/graph.js";
import { planSplitEffects } from "../../../src/knowledge/subject-identity/pure/planning.js";
import { assertEdge, decision, period, scope } from "./fixtures.js";

const anchor = Schema.decodeSync(SubjectKey);

describe("EX24 planSplitEffects", () => {
  it.effect(
    "withdraws crossing same-as and asserts full cross-block distinctions",
    () =>
      Effect.gen(function* splitTriangle() {
        const ab = assertEdge(1, "A", "B");
        const bc = assertEdge(2, "B", "C");
        const ac = assertEdge(3, "A", "C");
        const projection = yield* projectIdentity(scope, [
          decision(1, [ab, bc, ac]),
        ]);
        const closure = yield* closeIdentity(
          projection,
          [anchor("A"), anchor("B"), anchor("C")],
          period()
        );
        const drafts = yield* maximalIdentityCells(closure, period());
        const frame = {
          assertionSegments: closure.segments,
          audience: "private-author" as const,
          cells: drafts.map((cell) => ({
            ...cell.structure,
            cellRef: cell.cellRef,
            comparisons: [],
            coveredClaimRefs: [],
          })),
          claims: [],
          closureAnchors: closure.anchors,
          frameRef: "00000000-0000-4000-8000-000000000099",
          interval: period(),
          kind: "subject-identity" as const,
          purpose: scope.purpose,
          requestedAnchors: [anchor("A"), anchor("B")] as const,
          schemaVersion: "subject-identity.v1" as const,
          worldRef: scope.worldRef,
        };
        const partitionsByCell = frame.cells.map((cell) => ({
          blocks: [[anchor("A")], [anchor("B"), anchor("C")]],
          cellRef: cell.cellRef,
        }));
        const plan = yield* planSplitEffects(
          projection,
          Schema.decodeUnknownSync(IdentityFrame)(frame),
          anchor("A"),
          partitionsByCell
        );
        expect(plan._tag).toBe("Allowed");
        if (plan._tag !== "Allowed") {
          return;
        }
        expect(
          plan.effectItems.some((item) => item._tag === "Withdraw")
        ).toBeTruthy();
        const distinctions = plan.effectItems.filter(
          (item) => item._tag === "Assert" && item.relation === "different-from"
        );
        expect(distinctions.length).toBeGreaterThanOrEqual(2);
      })
  );

  it.effect("blocks a partition that invents an unconnected block", () =>
    Effect.gen(function* disconnect() {
      const ab = assertEdge(1, "A", "B");
      const bc = assertEdge(2, "B", "C");
      const projection = yield* projectIdentity(scope, [decision(1, [ab, bc])]);
      const closure = yield* closeIdentity(
        projection,
        [anchor("A"), anchor("B"), anchor("C")],
        period()
      );
      const drafts = yield* maximalIdentityCells(closure, period());
      const frame = {
        assertionSegments: closure.segments,
        audience: "private-author" as const,
        cells: drafts.map((cell) => ({
          ...cell.structure,
          cellRef: cell.cellRef,
          comparisons: [],
          coveredClaimRefs: [],
        })),
        claims: [],
        closureAnchors: closure.anchors,
        frameRef: "00000000-0000-4000-8000-000000000098",
        interval: period(),
        kind: "subject-identity" as const,
        purpose: scope.purpose,
        requestedAnchors: [anchor("A"), anchor("B")] as const,
        schemaVersion: "subject-identity.v1" as const,
        worldRef: scope.worldRef,
      };
      // A|C keeps A and C together without an AC edge after withdrawing AB/BC paths.
      const partitionsByCell = frame.cells.map((cell) => ({
        blocks: [[anchor("A"), anchor("C")], [anchor("B")]],
        cellRef: cell.cellRef,
      }));
      const plan = yield* planSplitEffects(
        projection,
        Schema.decodeUnknownSync(IdentityFrame)(frame),
        anchor("A"),
        partitionsByCell
      );
      expect(plan._tag).toBe("Blocked");
      if (plan._tag === "Blocked") {
        expect(plan.blocked.reason).toBe("InvalidPartition");
      }
      const noSep = yield* planSplitEffects(
        projection,
        Schema.decodeUnknownSync(IdentityFrame)(frame),
        anchor("A"),
        frame.cells.map((cell) => ({
          blocks: [
            cell.components.find((item) => item.members.includes(anchor("A")))
              ?.members ?? [anchor("A")],
          ],
          cellRef: cell.cellRef,
        }))
      );
      expect(noSep._tag).toBe("Blocked");
    })
  );
});
