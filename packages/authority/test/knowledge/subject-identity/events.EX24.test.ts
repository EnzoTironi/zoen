import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";

import { projectIdentity } from "../../../src/knowledge/subject-identity/pure/events.js";
import { assertEdge, decision, id, period, scope } from "./fixtures.js";

const edge = assertEdge(1, "A", "B");
const first = decision(1, [edge]);
const middle = period("2026-09-10", "2026-09-20");
const withdrawal = {
  _tag: "Withdraw",
  assertionRef: edge.assertionRef,
  effectRef: id(4000),
  interval: middle,
};
const second = decision(2, [withdrawal], { kind: "split" });
const undoSecond = decision(
  3,
  [
    {
      _tag: "UndoEffect",
      effectRef: id(5000),
      targetEffectRef: withdrawal.effectRef,
    },
  ],
  { kind: "undo", targetDecisionRef: second.decisionRef }
);

describe("EX24 immutable identity event projection", () => {
  it.effect(
    "subtracts temporal masks without rewriting the original assertion",
    () =>
      Effect.gen(function* preserveAssertion() {
        const before = structuredClone([first, second]);
        const projection = yield* projectIdentity(scope, [second, first]);
        expect(projection.assertions).toHaveLength(1);
        expect(projection.assertions[0]?.effectiveIntervals).toStrictEqual([
          period("2026-09-01", "2026-09-10"),
          period("2026-09-20", "2026-10-01"),
        ]);
        expect(projection.assertions[0]?.assertion.interval).toStrictEqual(
          period()
        );
        expect([first, second]).toStrictEqual(before);
      })
  );

  it.effect(
    "undo cancels its own withdrawal and retains the full lineage",
    () =>
      Effect.gen(function* undoWithdrawal() {
        const projection = yield* projectIdentity(scope, [
          undoSecond,
          first,
          second,
        ]);
        expect(projection.assertions[0]?.effectiveIntervals).toStrictEqual([
          period(),
        ]);
        expect(projection.assertions[0]?.withdrawals).toStrictEqual([]);
        expect(
          projection.decisions.map((item) => item.decisionRef)
        ).toStrictEqual([
          first.decisionRef,
          second.decisionRef,
          undoSecond.decisionRef,
        ]);
        expect(projection.undoneDecisionRefs).toStrictEqual([
          second.decisionRef,
        ]);
      })
  );

  it.effect(
    "a different active withdrawal still masks the restored assertion",
    () =>
      Effect.gen(function* preserveIndependentWithdrawal() {
        const independent = decision(
          3,
          [{ ...withdrawal, effectRef: id(4001) }],
          { kind: "split" }
        );
        const undo = decision(4, undoSecond.effectItems, {
          kind: "undo",
          targetDecisionRef: second.decisionRef,
        });
        const projection = yield* projectIdentity(scope, [
          first,
          second,
          independent,
          undo,
        ]);
        expect(projection.assertions[0]?.effectiveIntervals).toStrictEqual([
          period("2026-09-01", "2026-09-10"),
          period("2026-09-20", "2026-10-01"),
        ]);
        expect(
          projection.assertions[0]?.withdrawals.map((item) => item.effectRef)
        ).toStrictEqual([id(4001)]);
      })
  );

  it.effect(
    "hidden author and World never affect output or duplicate-id validation",
    () =>
      Effect.gen(function* isolateScopes() {
        const hiddenAuthor = decision(1, [edge], { authoredBy: id(999) });
        const hiddenWorld = decision(1, [edge], {
          worldRef: { realm: "live", worldId: id(998) },
        });
        const baseline = yield* projectIdentity(scope, [first]);
        expect(
          yield* projectIdentity(scope, [hiddenWorld, first, hiddenAuthor])
        ).toStrictEqual(baseline);
      })
  );

  it.effect(
    "rejects partial undo, repeated IDs, missing targets and undo of undo",
    () =>
      Effect.gen(function* rejectInvalidHistory() {
        const twoEffects = decision(1, [edge, assertEdge(2, "B", "C")]);
        const partialUndo = decision(
          2,
          [
            {
              _tag: "UndoEffect",
              effectRef: id(6000),
              targetEffectRef: edge.effectRef,
            },
          ],
          { kind: "undo", targetDecisionRef: twoEffects.decisionRef }
        );
        const undoUndo = decision(
          4,
          [
            {
              _tag: "UndoEffect",
              effectRef: id(6001),
              targetEffectRef: id(5000),
            },
          ],
          { kind: "undo", targetDecisionRef: undoSecond.decisionRef }
        );
        for (const history of [
          [twoEffects, partialUndo],
          [first, first],
          [second],
          [first, second, undoSecond, undoUndo],
          [first, second, partialUndo],
        ]) {
          const result = yield* Effect.result(projectIdentity(scope, history));
          expect(Result.isFailure(result)).toBeTruthy();
          if (Result.isFailure(result)) {
            expect(result.failure._tag).toBe("InvalidInput");
          }
        }
      })
  );
});
