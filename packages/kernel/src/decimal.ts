import { fail, ok, requireThat, toPublicFailure, type Result } from './result.js';

export type Decimal = Readonly<{ coefficient: bigint; scale: number }>;
export type Rounding = 'reject' | 'toward-zero' | 'half-even' | 'floor' | 'ceil';
export type ScalePolicy = Readonly<{ scale: number; rounding: Rounding }>;

const MAX_INTEGER_DIGITS = 20;
const MAX_SCALE = 18;

function power(n: number): bigint {
  requireThat(Number.isInteger(n) && n >= 0 && n <= 76, 'DECIMAL_SCALE');
  return 10n ** BigInt(n);
}
function abs(n: bigint): bigint {
  return n < 0n ? -n : n;
}

function catching<T>(fn: () => T): Result<T> {
  try {
    return ok(fn());
  } catch (error) {
    return toPublicFailure(error);
  }
}

export function decimal(coefficient: bigint, scale: number): Decimal {
  requireThat(Number.isInteger(scale) && scale >= 0 && scale <= MAX_SCALE, 'DECIMAL_SCALE');
  requireThat(abs(coefficient) < power(MAX_INTEGER_DIGITS + scale), 'DECIMAL_OVERFLOW');
  return Object.freeze({ coefficient, scale });
}

export function parseDecimal(text: string): Decimal {
  requireThat(text.length <= 41 && /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(text), 'DECIMAL_SYNTAX');
  const [whole, fraction = ''] = text.split('.');
  return decimal(BigInt(`${whole}${fraction}`), fraction.length);
}

/** Spec operation: normalizeDecimal(text, scalePolicy) -> Decimal | InvalidScalar */
export function normalizeDecimal(text: string, scalePolicy: ScalePolicy): Result<Decimal> {
  return catching(() => quantize(parseDecimal(text), scalePolicy.scale, scalePolicy.rounding));
}

export function formatDecimal(value: Decimal): string {
  decimal(value.coefficient, value.scale);
  const digits = abs(value.coefficient).toString().padStart(value.scale + 1, '0');
  const sign = value.coefficient < 0n ? '-' : '';
  return sign + (value.scale === 0 ? digits : `${digits.slice(0, -value.scale)}.${digits.slice(-value.scale)}`);
}

export function canonicalDecimal(value: Decimal): string {
  let { coefficient, scale } = decimal(value.coefficient, value.scale);
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n;
    scale--;
  }
  return formatDecimal(decimal(coefficient, scale));
}

function scaled(a: Decimal, b: Decimal): readonly [bigint, bigint, number] {
  decimal(a.coefficient, a.scale);
  decimal(b.coefficient, b.scale);
  const scale = Math.max(a.scale, b.scale);
  return [a.coefficient * power(scale - a.scale), b.coefficient * power(scale - b.scale), scale];
}

export function add(a: Decimal, b: Decimal): Decimal {
  const [x, y, scale] = scaled(a, b);
  return decimal(x + y, scale);
}
export function subtract(a: Decimal, b: Decimal): Decimal {
  const [x, y, scale] = scaled(a, b);
  return decimal(x - y, scale);
}
export function compare(a: Decimal, b: Decimal): -1 | 0 | 1 {
  const [x, y] = scaled(a, b);
  return x < y ? -1 : x > y ? 1 : 0;
}

function roundDivide(n: bigint, d: bigint, rounding: Rounding): bigint {
  requireThat(d > 0n, 'DIVISION_BY_ZERO');
  const q = n / d;
  const r = n % d;
  if (r === 0n) return q;
  requireThat(rounding !== 'reject', 'ROUNDING_REQUIRED');
  const sign = n < 0n ? -1n : 1n;
  switch (rounding) {
    case 'toward-zero':
      return q;
    case 'floor':
      return n < 0n ? q - 1n : q;
    case 'ceil':
      return n > 0n ? q + 1n : q;
    case 'half-even': {
      const twice = 2n * abs(r);
      return twice > d || (twice === d && abs(q) % 2n === 1n) ? q + sign : q;
    }
  }
}

export function quantize(value: Decimal, scale: number, rounding: Rounding): Decimal {
  decimal(value.coefficient, value.scale);
  requireThat(scale >= 0 && scale <= MAX_SCALE && Number.isInteger(scale), 'DECIMAL_SCALE');
  return scale >= value.scale
    ? decimal(value.coefficient * power(scale - value.scale), scale)
    : decimal(roundDivide(value.coefficient, power(value.scale - scale), rounding), scale);
}

export function multiply(a: Decimal, b: Decimal, scale: number, rounding: Rounding): Decimal {
  decimal(a.coefficient, a.scale);
  decimal(b.coefficient, b.scale);
  requireThat(Number.isInteger(scale) && scale >= 0 && scale <= MAX_SCALE, 'DECIMAL_SCALE');
  const raw = a.coefficient * b.coefficient;
  const rawScale = a.scale + b.scale;
  return decimal(rawScale <= scale ? raw * power(scale - rawScale) : roundDivide(raw, power(rawScale - scale), rounding), scale);
}

export function divide(a: Decimal, b: Decimal, scale: number, rounding: Rounding): Decimal {
  decimal(a.coefficient, a.scale);
  decimal(b.coefficient, b.scale);
  requireThat(b.coefficient !== 0n, 'DIVISION_BY_ZERO');
  requireThat(Number.isInteger(scale) && scale >= 0 && scale <= MAX_SCALE, 'DECIMAL_SCALE');
  const exponent = scale + b.scale - a.scale;
  const n = a.coefficient * (exponent >= 0 ? power(exponent) : 1n) * (b.coefficient < 0n ? -1n : 1n);
  const d = abs(b.coefficient) * (exponent < 0 ? power(-exponent) : 1n);
  return decimal(roundDivide(n, d, rounding), scale);
}

export type Money = Readonly<{ amount: Decimal; currency: string }>;
export function money(amount: string, currency: string): Money {
  requireThat(/^[A-Z]{3}$/.test(currency), 'CURRENCY_SYNTAX');
  return Object.freeze({ amount: parseDecimal(amount), currency });
}
export function addMoney(a: Money, b: Money): Money {
  requireThat(a.currency === b.currency, 'CURRENCY_MISMATCH');
  return Object.freeze({ amount: add(a.amount, b.amount), currency: a.currency });
}

export type ComparableMoney = Readonly<{ tag: 'Comparable'; order: -1 | 0 | 1; currency: string }>;
export type NonComparableMoney = Readonly<{ tag: 'NonComparable'; code: 'CURRENCY_MISMATCH' | 'MISSING_CONVERSION' }>;
export type MoneyComparison = ComparableMoney | NonComparableMoney;

/** Compare money without coercion; mixed currencies are NonComparable. */
export function compareMoney(a: Money, b: Money): MoneyComparison {
  if (a.currency !== b.currency) return Object.freeze({ tag: 'NonComparable', code: 'CURRENCY_MISMATCH' });
  return Object.freeze({ tag: 'Comparable', order: compare(a.amount, b.amount), currency: a.currency });
}

export function parseMoney(amount: unknown, currency: unknown): Result<Money> {
  if (typeof amount !== 'string' || typeof currency !== 'string') return fail('InvalidInput', 'INVALID_SCALAR');
  return catching(() => money(amount, currency));
}

export function tryAddMoney(a: Money, b: Money): Result<Money> {
  return catching(() => addMoney(a, b));
}

/** Mass dimension units used by the g/kg acceptance oracle. */
export type UnitCode = string;
export type Dimension = 'mass' | 'currency' | 'dimensionless';

export type Quantity = Readonly<{ amount: Decimal; unit: UnitCode; dimension: Dimension }>;

const UNIT_DIMENSION: Readonly<Record<string, Dimension>> = Object.freeze({
  g: 'mass',
  kg: 'mass',
  mg: 'mass',
});

export function quantity(amount: string, unit: UnitCode): Quantity {
  requireThat(/^[a-z][a-z0-9]{0,15}$/.test(unit), 'UNIT_SYNTAX');
  const dimension = UNIT_DIMENSION[unit];
  requireThat(dimension !== undefined, 'UNSUPPORTED_UNIT');
  return Object.freeze({ amount: parseDecimal(amount), unit, dimension });
}

/**
 * Released conversion factor between two units of equal dimension.
 * Factor means: 1 fromUnit = factor toUnit (exact decimal string).
 */
export type ReleasedConversion = Readonly<{
  fromUnit: UnitCode;
  toUnit: UnitCode;
  factor: Decimal;
  evidenceId: string;
  effectiveFrom: string;
}>;

export function releasedConversion(input: {
  fromUnit: UnitCode;
  toUnit: UnitCode;
  factor: string;
  evidenceId: string;
  effectiveFrom: string;
}): ReleasedConversion {
  requireThat(/^[a-z][a-z0-9]{0,15}$/.test(input.fromUnit), 'UNIT_SYNTAX');
  requireThat(/^[a-z][a-z0-9]{0,15}$/.test(input.toUnit), 'UNIT_SYNTAX');
  requireThat(UNIT_DIMENSION[input.fromUnit] !== undefined && UNIT_DIMENSION[input.toUnit] !== undefined, 'UNSUPPORTED_UNIT');
  requireThat(UNIT_DIMENSION[input.fromUnit] === UNIT_DIMENSION[input.toUnit], 'DIMENSION_MISMATCH');
  requireThat(/^[a-z0-9][a-z0-9._-]{0,127}$/.test(input.evidenceId), 'CONVERSION_EVIDENCE');
  requireThat(/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom), 'CONVERSION_EFFECTIVE');
  const factor = parseDecimal(input.factor);
  requireThat(factor.coefficient > 0n, 'CONVERSION_FACTOR');
  return Object.freeze({
    fromUnit: input.fromUnit,
    toUnit: input.toUnit,
    factor,
    evidenceId: input.evidenceId,
    effectiveFrom: input.effectiveFrom,
  });
}

export function convertQuantity(value: Quantity, conversion: ReleasedConversion, scale = 18, rounding: Rounding = 'reject'): Quantity {
  requireThat(value.unit === conversion.fromUnit, 'CONVERSION_UNIT_MISMATCH');
  requireThat(value.dimension === UNIT_DIMENSION[conversion.toUnit], 'DIMENSION_MISMATCH');
  return Object.freeze({
    amount: multiply(value.amount, conversion.factor, scale, rounding),
    unit: conversion.toUnit,
    dimension: value.dimension,
  });
}

export type ComparableQuantity = Readonly<{ tag: 'Comparable'; order: -1 | 0 | 1; unit: UnitCode }>;
export type NonComparableQuantity = Readonly<{
  tag: 'NonComparable';
  code: 'UNIT_MISMATCH' | 'DIMENSION_MISMATCH' | 'MISSING_CONVERSION';
}>;
export type QuantityComparison = ComparableQuantity | NonComparableQuantity;

/**
 * Compare quantities. Equal units compare directly.
 * Different units require an explicit released conversion covering a->b or b->a.
 */
export function compareQuantities(
  a: Quantity,
  b: Quantity,
  conversion?: ReleasedConversion,
): QuantityComparison {
  if (a.dimension !== b.dimension) return Object.freeze({ tag: 'NonComparable', code: 'DIMENSION_MISMATCH' });
  if (a.unit === b.unit) {
    return Object.freeze({ tag: 'Comparable', order: compare(a.amount, b.amount), unit: a.unit });
  }
  if (!conversion) return Object.freeze({ tag: 'NonComparable', code: 'MISSING_CONVERSION' });
  if (conversion.fromUnit === a.unit && conversion.toUnit === b.unit) {
    const converted = convertQuantity(a, conversion);
    return Object.freeze({ tag: 'Comparable', order: compare(converted.amount, b.amount), unit: b.unit });
  }
  if (conversion.fromUnit === b.unit && conversion.toUnit === a.unit) {
    const converted = convertQuantity(b, conversion);
    return Object.freeze({ tag: 'Comparable', order: compare(a.amount, converted.amount), unit: a.unit });
  }
  return Object.freeze({ tag: 'NonComparable', code: 'MISSING_CONVERSION' });
}

/** Largest-remainder allocation, tie-broken by stable IDs, including negative totals. */
export function allocate(
  total: Decimal,
  weights: readonly Readonly<{ id: string; weight: Decimal }>[],
): Readonly<Record<string, Decimal>> {
  requireThat(weights.length > 0 && weights.length <= 1000 && new Set(weights.map((w) => w.id)).size === weights.length, 'ALLOCATION_WEIGHTS');
  for (const w of weights) {
    requireThat(/^[a-zA-Z0-9_-]{1,64}$/.test(w.id), 'ALLOCATION_ID');
    decimal(w.weight.coefficient, w.weight.scale);
    requireThat(w.weight.coefficient >= 0n, 'NEGATIVE_WEIGHT');
  }
  decimal(total.coefficient, total.scale);
  const scale = Math.max(...weights.map((w) => w.weight.scale));
  const integerWeights = weights.map((w) => ({ id: w.id, value: w.weight.coefficient * power(scale - w.weight.scale) }));
  const denominator = integerWeights.reduce((sum, w) => sum + w.value, 0n);
  requireThat(denominator > 0n, 'ZERO_TOTAL_WEIGHT');
  const magnitude = abs(total.coefficient);
  const pieces = integerWeights.map((w) => ({
    id: w.id,
    value: (magnitude * w.value) / denominator,
    remainder: (magnitude * w.value) % denominator,
  }));
  let left = magnitude - pieces.reduce((sum, p) => sum + p.value, 0n);
  pieces.sort((a, b) => (a.remainder > b.remainder ? -1 : a.remainder < b.remainder ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const piece of pieces) {
    if (left > 0n) {
      piece.value++;
      left--;
    }
  }
  requireThat(left === 0n, 'ALLOCATION_CONSERVATION');
  const result: Record<string, Decimal> = Object.create(null) as Record<string, Decimal>;
  for (const piece of pieces) result[piece.id] = decimal(piece.value * (total.coefficient < 0n ? -1n : 1n), total.scale);
  return Object.freeze(result);
}

export const DECIMAL_LIMITS = Object.freeze({ precision: 38, maxScale: MAX_SCALE, maxIntegerDigits: MAX_INTEGER_DIGITS });
