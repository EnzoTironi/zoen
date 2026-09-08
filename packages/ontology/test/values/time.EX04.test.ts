import { DateInterval, InstantInterval } from "@zoen/contracts/worlds/values";
import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";

import { intervalRelation } from "../../src/values/time.js";

const dates = (from: string, to: string) =>
  Schema.decodeSync(DateInterval)({ _tag: "DateInterval", from, to });
const instants = (from: string, to: string) =>
  Schema.decodeSync(InstantInterval)({ _tag: "InstantInterval", from, to });

describe("EX04 half-open time values", () => {
  it.each([
    ["2026-09-01", "2026-09-02", "2026-09-02", "2026-09-03", "Disjoint"],
    ["2026-09-01", "2026-09-03", "2026-09-02", "2026-09-04", "Overlapping"],
    ["2026-09-01", "2026-09-05", "2026-09-02", "2026-09-03", "Overlapping"],
    ["0001-01-01", "9999-12-31", "2024-02-29", "2024-03-01", "Overlapping"],
  ])(
    "compares civil intervals without timestamps",
    (fromA, toA, fromB, toB, expected) => {
      const a = dates(fromA, toA);
      const b = dates(fromB, toB);
      expect(Effect.runSync(intervalRelation(a, b))).toBe(expected);
      expect(Effect.runSync(intervalRelation(b, a))).toBe(expected);
    }
  );

  it("compares milliseconds explicitly and does not treat adjacency as overlap", () => {
    const first = instants(
      "2026-09-01T00:00:00.000Z",
      "2026-09-01T00:00:00.001Z"
    );
    const next = instants(
      "2026-09-01T00:00:00.001Z",
      "2026-09-01T00:00:00.002Z"
    );
    expect(Effect.runSync(intervalRelation(first, next))).toBe("Disjoint");
    expect(Effect.runSync(intervalRelation(first, first))).toBe("Overlapping");
  });

  it("preserves unknown time and refuses implicit civil-to-instant conversion", () => {
    const civil = dates("2026-09-01", "2026-09-02");
    const instant = instants(
      "2026-09-01T00:00:00.000Z",
      "2026-09-02T00:00:00.000Z"
    );
    expect(Effect.runSync(intervalRelation(civil, instant))).toBe(
      "NotComparable"
    );
    expect(Effect.runSync(intervalRelation(instant, civil))).toBe(
      "NotComparable"
    );
    expect(Effect.runSync(intervalRelation(civil, { _tag: "Unknown" }))).toBe(
      "Unknown"
    );
    expect(
      Effect.runSync(intervalRelation({ _tag: "Unknown" }, { _tag: "Unknown" }))
    ).toBe("Unknown");
  });
});
