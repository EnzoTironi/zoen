import { describe, expect, it } from "@effect/vitest";
import { SubjectKey } from "@zoen/contracts/d01/values";
import { Effect, Result, Schema } from "effect";

import {
  maximalIdentityCells,
  validateComparisonClaims,
} from "../../../src/knowledge/subject-identity/pure/cells.js";
import { compareIdentityCells } from "../../../src/knowledge/subject-identity/pure/comparison.js";
import { projectIdentity } from "../../../src/knowledge/subject-identity/pure/events.js";
import { closeIdentity } from "../../../src/knowledge/subject-identity/pure/graph.js";
import { assertEdge, claim, decision, period, scope } from "./fixtures.js";

const anchor = Schema.decodeSync(SubjectKey);
const merged = Effect.gen(function* mergedClosure() {
  const projection = yield* projectIdentity(scope, [
    decision(1, [assertEdge(1, "A", "B")]),
  ]);
  return yield* closeIdentity(projection, [anchor("A"), anchor("B")], period());
});

describe("EX24 maximal temporal identity cells and comparisons", () => {
  it.effect(
    "splits a mixed identity query and preserves original claim periods and values",
    () =>
      Effect.gen(function* compareTemporalRegimes() {
        const whole = period("2026-09-15", "2026-10-15");
        const october = period("2026-10-01", "2026-11-01");
        const projection = yield* projectIdentity(scope, [
          decision(1, [assertEdge(1, "A", "B")]),
          decision(2, [assertEdge(2, "A", "B", "different-from", october)], {
            interval: october,
          }),
        ]);
        const closure = yield* closeIdentity(projection, [anchor("A")], whole);
        const claims = [
          claim(1, "A", { validTime: period("2026-09-01", "2026-11-01") }),
          claim(2, "B", {
            validTime: period("2026-09-01", "2026-11-01"),
            value: { _tag: "Known", amount: "120", currency: "BRL" },
          }),
        ];
        const original = structuredClone(claims);
        const cells = yield* maximalIdentityCells(closure, whole, claims);
        const compared = yield* compareIdentityCells(closure, cells, claims);
        expect(compared.map((cell) => cell.interval)).toStrictEqual([
          period("2026-09-15", "2026-10-01"),
          period("2026-10-01", "2026-10-15"),
        ]);
        expect(
          compared.map((cell) => cell.comparisons[0]?.status)
        ).toStrictEqual(["conflict", "not-comparable"]);
        expect(compared[1]?.comparisons[0]?.reasons).toStrictEqual([
          "different-subjects",
        ]);
        expect(claims).toStrictEqual(original);
      })
  );

  it.effect(
    "only known covering periods enter support; unknown remains explicit",
    () =>
      Effect.gen(function* preserveUnknownPeriod() {
        const closure = yield* merged;
        const known = claim(1, "A");
        const unknown = claim(2, "B", { validTime: { _tag: "Unknown" } });
        const cells = yield* maximalIdentityCells(closure, period(), [
          known,
          unknown,
        ]);
        const compared = yield* compareIdentityCells(closure, cells, [
          known,
          unknown,
        ]);
        expect(compared[0]?.coveredClaimRefs).toStrictEqual([known.claimRef]);
        expect(compared[0]?.comparisons[0]?.status).toBe("unknown");
        expect(compared[0]?.comparisons[0]?.reasons).toStrictEqual([
          "unknown-period",
        ]);
      })
  );

  it.effect(
    "uses exact decimal comparison and never compares incompatible currencies",
    () =>
      Effect.gen(function* compareExactValues() {
        const closure = yield* merged;
        const claims = [
          claim(1, "A"),
          claim(2, "B", {
            value: { _tag: "Known", amount: "100.00", currency: "BRL" },
          }),
          claim(3, "B", {
            value: { _tag: "Known", amount: "100", currency: "USD" },
          }),
        ];
        const cells = yield* maximalIdentityCells(closure, period(), claims);
        const compared = yield* compareIdentityCells(closure, cells, claims);
        expect(
          compared[0]?.comparisons.map((item) => item.status)
        ).toStrictEqual(["agree", "not-comparable", "not-comparable"]);
      })
  );

  it.effect(
    "normal cells expose single-claim support boundaries that recovery does not inherit",
    () =>
      Effect.gen(function* explainCoverage() {
        const closure = yield* merged;
        const single = claim(1, "A", {
          validTime: period("2026-09-10", "2026-09-20"),
        });
        const normal = yield* maximalIdentityCells(closure, period(), [single]);
        const recovery = yield* maximalIdentityCells(closure, period());
        expect(normal.map((cell) => cell.coveredClaimRefs)).toStrictEqual([
          [],
          [single.claimRef],
          [],
        ]);
        expect(recovery).toHaveLength(1);
        const permuted = yield* maximalIdentityCells(
          { ...closure, segments: closure.segments.toReversed() },
          period(),
          [single]
        );
        expect(permuted).toStrictEqual(normal);
      })
  );

  it.effect(
    "too many pairs reject the entire normal comparison while recovery remains available",
    () =>
      Effect.gen(function* recoverAfterClaimsOverflow() {
        const closure = yield* merged;
        const claims = Array.from({ length: 24 }, (_, index) =>
          claim(index + 1, index < 12 ? "A" : "B")
        );
        const valid = yield* validateComparisonClaims(closure, claims);
        const normal = yield* maximalIdentityCells(closure, period(), valid);
        const result = yield* Effect.result(
          compareIdentityCells(closure, normal, valid)
        );
        expect(Result.isFailure(result)).toBeTruthy();
        if (Result.isFailure(result)) {
          expect(result.failure._tag).toBe("QuotaExceeded");
        }
        expect(yield* maximalIdentityCells(closure, period())).toHaveLength(1);
      })
  );
});
