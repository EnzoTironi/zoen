import { describe, expect, it } from "@effect/vitest";
import { DateInterval } from "@zoen/contracts/d01/values";
import { Schema } from "effect";

import {
  covers,
  intersection,
  intervalCells,
  overlaps,
  subtractIntervals,
  unionIntervals,
} from "../../../src/knowledge/subject-identity/pure/intervals.js";

const period = (from: string, to: string) =>
  Schema.decodeSync(DateInterval)({ _tag: "DateInterval", from, to });
const full = period("2026-09-01", "2026-11-01");
const september = period("2026-09-01", "2026-10-01");
const october = period("2026-10-01", "2026-11-01");

describe("EX24 civil interval operations", () => {
  it("preserves exclusive boundaries and does not introduce adjacent overlap", () => {
    expect(overlaps(september, october)).toBeFalsy();
    expect(intersection(september, october)).toBeUndefined();
    expect(covers(full, september)).toBeTruthy();
    expect(covers(september, full)).toBeFalsy();
    expect(subtractIntervals(full, [september])).toStrictEqual([october]);
  });

  it("withdrawals commute and preserve every unaffected subinterval", () => {
    const first = period("2026-09-10", "2026-09-20");
    const second = period("2026-09-15", "2026-10-15");
    const expected = [
      period("2026-09-01", "2026-09-10"),
      period("2026-10-15", "2026-11-01"),
    ];
    expect(subtractIntervals(full, [first, second])).toStrictEqual(expected);
    expect(subtractIntervals(full, [second, first, first])).toStrictEqual(
      expected
    );
    expect(subtractIntervals(full, [full])).toStrictEqual([]);
    expect(
      subtractIntervals(full, [period("2025-01-01", "2026-09-01")])
    ).toStrictEqual([full]);
  });

  it("coalesces the union without filling a temporal gap", () => {
    expect(unionIntervals([october, september, september])).toStrictEqual([
      full,
    ]);
    const afterGap = period("2026-10-02", "2026-11-01");
    expect(unionIntervals([afterGap, september])).toStrictEqual([
      september,
      afterGap,
    ]);
  });

  it("clips, sorts and deduplicates event boundaries independently of input order", () => {
    const outside = period("2026-01-01", "2027-01-01");
    expect(
      intervalCells(full, [
        outside.to,
        october.from,
        full.from,
        outside.from,
        october.from,
      ])
    ).toStrictEqual([september, october]);
  });
});
