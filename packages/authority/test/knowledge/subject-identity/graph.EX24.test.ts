import { describe, expect, it } from "@effect/vitest";
import { SubjectKey } from "@zoen/contracts/d01/values";
import { Effect, Result, Schema } from "effect";

import { projectIdentity } from "../../../src/knowledge/subject-identity/pure/events.js";
import {
  closeIdentity,
  relationBetween,
  structureForCell,
} from "../../../src/knowledge/subject-identity/pure/graph.js";
import { assertEdge, decision, period, scope } from "./fixtures.js";

const anchor = Schema.decodeSync(SubjectKey);
const structure = (effects: readonly unknown[]) =>
  Effect.gen(function* buildStructure() {
    const projection = yield* projectIdentity(scope, [decision(1, effects)]);
    const closure = yield* closeIdentity(projection, [anchor("A")], period());
    return { cell: yield* structureForCell(closure, period()), closure };
  });

describe("EX24 complete signed identity graph", () => {
  it.effect(
    "closes equality transitively and reaches neighbors through both signs",
    () =>
      Effect.gen(function* closeBothSigns() {
        const { cell, closure } = yield* structure([
          assertEdge(3, "C", "D", "different-from"),
          assertEdge(4, "D", "E"),
          assertEdge(2, "B", "C"),
          assertEdge(1, "A", "B"),
        ]);
        expect(closure.anchors).toStrictEqual(["A", "B", "C", "D", "E"]);
        expect(cell.components).toStrictEqual([
          { members: ["A", "B", "C"], representative: "A" },
          { members: ["D", "E"], representative: "D" },
        ]);
        expect(relationBetween(cell, anchor("A"), anchor("C"))).toBe("same-as");
        expect(relationBetween(cell, anchor("B"), anchor("E"))).toBe(
          "different-from"
        );
      })
  );

  it.effect(
    "does not turn a chain of distinctions into a transitive distinction",
    () =>
      Effect.gen(function* keepDifferenceNonTransitive() {
        const { cell } = yield* structure([
          assertEdge(1, "A", "B", "different-from"),
          assertEdge(2, "B", "C", "different-from"),
        ]);
        expect(relationBetween(cell, anchor("A"), anchor("C"))).toBe(
          "unresolved"
        );
        expect(relationBetween(cell, anchor("A"), anchor("A"))).toBe("same-as");
      })
  );

  it.effect(
    "rejects a distinction internal to any positive path including a cycle",
    () =>
      Effect.gen(function* rejectContradiction() {
        for (const edges of [
          [
            assertEdge(1, "A", "B"),
            assertEdge(2, "B", "C"),
            assertEdge(3, "A", "C", "different-from"),
          ],
          [
            assertEdge(1, "A", "B"),
            assertEdge(2, "B", "C"),
            assertEdge(3, "A", "C"),
            assertEdge(4, "A", "B", "different-from"),
          ],
        ]) {
          const result = yield* Effect.result(structure(edges));
          expect(Result.isFailure(result)).toBeTruthy();
          if (Result.isFailure(result)) {
            expect(result.failure._tag).toBe("Conflict");
          }
        }
      })
  );

  it.effect(
    "preserves identity through an alternate path when one triangle edge is absent",
    () =>
      Effect.gen(function* keepAlternatePath() {
        const { cell } = yield* structure([
          assertEdge(2, "B", "C"),
          assertEdge(3, "A", "C"),
        ]);
        expect(relationBetween(cell, anchor("A"), anchor("B"))).toBe("same-as");
        expect(cell.activeAssertionRefs).toHaveLength(2);
      })
  );

  it.effect(
    "does not discard temporally disjoint edges from the complete interval closure",
    () =>
      Effect.gen(function* scopeTemporalClosure() {
        const whole = period("2026-09-01", "2026-11-01");
        const october = period("2026-10-01", "2026-11-01");
        const projection = yield* projectIdentity(scope, [
          decision(1, [assertEdge(1, "A", "B")]),
          decision(2, [assertEdge(2, "B", "C", "same-as", october)], {
            interval: october,
          }),
        ]);
        const closure = yield* closeIdentity(projection, [anchor("A")], whole);
        expect(closure.anchors).toStrictEqual(["A", "B", "C"]);
        const septemberCell = yield* structureForCell(closure, period());
        const octoberCell = yield* structureForCell(closure, october);
        expect(relationBetween(septemberCell, anchor("A"), anchor("C"))).toBe(
          "unresolved"
        );
        expect(relationBetween(octoberCell, anchor("B"), anchor("C"))).toBe(
          "same-as"
        );
        const mixed = yield* Effect.result(structureForCell(closure, whole));
        expect(Result.isFailure(mixed)).toBeTruthy();
      })
  );

  it.effect(
    "rejects complete regions above anchor or segment limits without truncation",
    () =>
      Effect.gen(function* rejectGraphOverflow() {
        const chain = Array.from({ length: 32 }, (_, index) =>
          assertEdge(
            index + 1,
            `A${String(index).padStart(2, "0")}`,
            `A${String(index + 1).padStart(2, "0")}`
          )
        );
        const duplicates = Array.from({ length: 129 }, (_, index) =>
          assertEdge(index + 1, "A00", "B")
        );
        for (const edges of [chain, duplicates]) {
          const projection = yield* projectIdentity(scope, [
            decision(1, edges),
          ]);
          const result = yield* Effect.result(
            closeIdentity(projection, [anchor("A00")], period())
          );
          expect(Result.isFailure(result)).toBeTruthy();
          if (Result.isFailure(result)) {
            expect(result.failure._tag).toBe("QuotaExceeded");
          }
        }
      })
  );
});
