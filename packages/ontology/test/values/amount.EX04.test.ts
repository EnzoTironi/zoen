import { DecimalText, ExactAmount } from "@zoen/contracts/worlds/values";
import { Effect, Result, Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  addAmounts,
  compareAmounts,
  normalizeDecimal,
  roundAmount,
} from "../../src/values/amount.js";

const money = (amount: string, currency: "BRL" | "USD" | "EUR" = "BRL") =>
  Schema.decodeSync(ExactAmount)({ amount, currency });
const failed = <A, E>(effect: Effect.Effect<A, E>) =>
  Result.isFailure(Effect.runSync(Effect.result(effect)));

describe("EX04 exact amount arithmetic", () => {
  it.each([
    ["0.10", "0.20", "0.30"],
    ["9007199254740993.01", "0.01", "9007199254740993.02"],
    [
      "99999999999999999999.999999999999999998",
      "0.000000000000000001",
      "99999999999999999999.999999999999999999",
    ],
    ["-1.25", "0.50", "-0.75"],
    ["1", "0.00", "1.00"],
    ["-0.00", "0.0", "0.00"],
  ])("adds %s + %s = %s without Number coercion", (a, b, sum) => {
    expect(Effect.runSync(addAmounts(money(a), money(b)))).toStrictEqual(
      money(sum)
    );
    expect(Effect.runSync(addAmounts(money(b), money(a)))).toStrictEqual(
      money(sum)
    );
  });

  it("rejects overflow rather than truncating NUMERIC(38,18)", () => {
    const maximum = money("99999999999999999999.999999999999999999");
    expect(
      failed(addAmounts(maximum, money("0.000000000000000001")))
    ).toBeTruthy();
    expect(
      failed(addAmounts(money("-99999999999999999999"), money("-1")))
    ).toBeTruthy();
    expect(failed(roundAmount(maximum, 0, "half-even"))).toBeTruthy();
  });

  it("keeps incomparable currency separate from greater/less/equal", () => {
    expect(
      Effect.runSync(compareAmounts(money("1"), money("1.00")))
    ).toStrictEqual({ _tag: "Comparable", order: 0 });
    expect(
      Effect.runSync(compareAmounts(money("2"), money("1")))
    ).toStrictEqual({ _tag: "Comparable", order: 1 });
    expect(
      Effect.runSync(compareAmounts(money("-2"), money("-1")))
    ).toStrictEqual({ _tag: "Comparable", order: -1 });
    expect(
      Effect.runSync(compareAmounts(money("1", "BRL"), money("1", "USD")))
    ).toStrictEqual({ _tag: "NotComparable", reason: "CurrencyMismatch" });
    expect(
      failed(addAmounts(money("1", "BRL"), money("1", "EUR")))
    ).toBeTruthy();
  });

  it.each([
    ["-0.000", "0"],
    ["1000.00", "1000"],
    ["0.000000000000000001", "0.000000000000000001"],
    ["-10.2500", "-10.25"],
  ])(
    "normalizes %s explicitly to %s without exponent notation",
    (input, expected) => {
      const normalized = Effect.runSync(
        normalizeDecimal(Schema.decodeSync(DecimalText)(input))
      );
      expect(normalized).toBe(expected);
      expect(Effect.runSync(normalizeDecimal(normalized))).toBe(normalized);
    }
  );
});

describe("EX04 explicit rounding", () => {
  it.each([
    ["2.345", "2.34"],
    ["2.355", "2.36"],
    ["-2.345", "-2.34"],
    ["-2.355", "-2.36"],
    ["0.005", "0.00"],
    ["0.015", "0.02"],
  ])("half-even rounds %s to %s", (input, expected) => {
    expect(
      Effect.runSync(roundAmount(money(input), 2, "half-even"))
    ).toStrictEqual(money(expected));
  });

  it("distinguishes floor, ceil and toward-zero for negative amounts", () => {
    const input = money("-1.239");
    expect(Effect.runSync(roundAmount(input, 2, "floor"))).toStrictEqual(
      money("-1.24")
    );
    expect(Effect.runSync(roundAmount(input, 2, "ceil"))).toStrictEqual(
      money("-1.23")
    );
    expect(Effect.runSync(roundAmount(input, 2, "to-zero"))).toStrictEqual(
      money("-1.23")
    );
  });

  it("requires permission to lose precision and bounds the output scale", () => {
    expect(failed(roundAmount(money("1.239"), 2, "reject"))).toBeTruthy();
    expect(
      Effect.runSync(roundAmount(money("1.2300"), 2, "reject"))
    ).toStrictEqual(money("1.23"));
    expect(Effect.runSync(roundAmount(money("1"), 18, "reject"))).toStrictEqual(
      money("1.000000000000000000")
    );
    for (const scale of [-1, 19, 0.5, Number.NaN, Infinity]) {
      expect(failed(roundAmount(money("1"), scale, "half-even"))).toBeTruthy();
    }
  });
});
