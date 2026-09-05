import { InvalidInput } from "@zoen/contracts/d01/errors";
import { DecimalText, ExactAmount } from "@zoen/contracts/d01/values";
import { BigDecimal, Effect, Schema } from "effect";

const invalid = () => new InvalidInput({ code: "INVALID_INPUT" });
const decodeAmount = Schema.decodeEffect(ExactAmount);
const decodeDecimal = Schema.decodeEffect(DecimalText);

const decimal = (text: DecimalText) =>
  Effect.fromOption(BigDecimal.fromString(text)).pipe(Effect.mapError(invalid));

/** Bounded fixed notation: BigDecimal.format may choose scientific notation or remove scale. */
const fixed = (value: BigDecimal.BigDecimal): string => {
  const negative = value.value < 0n;
  const digits = (negative ? -value.value : value.value).toString();
  const sign = negative ? "-" : "";
  if (value.scale <= 0) {
    return `${sign}${digits}${"0".repeat(-value.scale)}`;
  }
  const padded = digits.padStart(value.scale + 1, "0");
  return `${sign}${padded.slice(0, -value.scale)}.${padded.slice(-value.scale)}`;
};

export const normalizeDecimal = (input: DecimalText) =>
  Effect.gen(function* normalizeDecimalValue() {
    const validated = yield* decodeDecimal(input);
    const parsed = yield* decimal(validated);
    return yield* decodeDecimal(fixed(BigDecimal.normalize(parsed)));
  }).pipe(Effect.catchTag("SchemaError", () => Effect.fail(invalid())));

export const addAmounts = (left: ExactAmount, right: ExactAmount) =>
  Effect.gen(function* addExactAmounts() {
    const first = yield* decodeAmount(left);
    const second = yield* decodeAmount(right);
    if (first.currency !== second.currency) {
      return yield* invalid();
    }
    const a = yield* decimal(first.amount);
    const b = yield* decimal(second.amount);
    // Retain the greater input scale even when a zero operand uses BigDecimal's fast path.
    const sum = BigDecimal.scale(
      BigDecimal.sum(a, b),
      Math.max(a.scale, b.scale)
    );
    return yield* decodeAmount({
      amount: fixed(sum),
      currency: first.currency,
    });
  }).pipe(Effect.catchTag("SchemaError", () => Effect.fail(invalid())));

export type AmountComparison =
  | { readonly _tag: "Comparable"; readonly order: -1 | 0 | 1 }
  | { readonly _tag: "NotComparable"; readonly reason: "CurrencyMismatch" };

export const compareAmounts = (
  left: ExactAmount,
  right: ExactAmount
): Effect.Effect<AmountComparison, InvalidInput> =>
  Effect.gen(function* compareExactAmounts() {
    const first = yield* decodeAmount(left);
    const second = yield* decodeAmount(right);
    if (first.currency !== second.currency) {
      return { _tag: "NotComparable", reason: "CurrencyMismatch" } as const;
    }
    const a = yield* decimal(first.amount);
    const b = yield* decimal(second.amount);
    return { _tag: "Comparable", order: BigDecimal.Order(a, b) } as const;
  }).pipe(Effect.catchTag("SchemaError", () => Effect.fail(invalid())));

const Rounding = Schema.Literals([
  "reject",
  "half-even",
  "floor",
  "ceil",
  "to-zero",
]);
export type Rounding = typeof Rounding.Type;
const FractionDigits = Schema.Int.check(
  Schema.isGreaterThanOrEqualTo(0),
  Schema.isLessThanOrEqualTo(18)
);

/** Rounding is always a caller-selected operation, never an import normalization. */
export const roundAmount = (
  input: ExactAmount,
  fractionDigits: number,
  mode: Rounding
) =>
  Effect.gen(function* roundExactAmount() {
    const validated = yield* decodeAmount(input);
    const scale = yield* Schema.decodeEffect(FractionDigits)(fractionDigits);
    const rounding = yield* Schema.decodeEffect(Rounding)(mode);
    const parsed = yield* decimal(validated.amount);
    const rounded =
      rounding === "reject"
        ? BigDecimal.scale(parsed, scale)
        : BigDecimal.round(parsed, { mode: rounding, scale });
    if (rounding === "reject" && !BigDecimal.equals(parsed, rounded)) {
      return yield* invalid();
    }
    return yield* decodeAmount({
      amount: fixed(BigDecimal.scale(rounded, scale)),
      currency: validated.currency,
    });
  }).pipe(Effect.catchTag("SchemaError", () => Effect.fail(invalid())));
