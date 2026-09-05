import { requireThat } from './result.js';
export type Decimal = Readonly<{ coefficient: bigint; scale: number }>;
export type Rounding = 'reject' | 'toward-zero' | 'half-even' | 'floor' | 'ceil';
const MAX_INTEGER_DIGITS = 20; const MAX_SCALE = 18;
function power(n: number): bigint { requireThat(Number.isInteger(n) && n >= 0 && n <= 76, 'DECIMAL_SCALE'); return 10n ** BigInt(n); }
function abs(n: bigint): bigint { return n < 0n ? -n : n; }
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
export function formatDecimal(value: Decimal): string {
  decimal(value.coefficient, value.scale); const digits = abs(value.coefficient).toString().padStart(value.scale + 1, '0');
  const sign = value.coefficient < 0n ? '-' : '';
  return sign + (value.scale === 0 ? digits : `${digits.slice(0, -value.scale)}.${digits.slice(-value.scale)}`);
}
export function canonicalDecimal(value: Decimal): string {
  let { coefficient, scale } = decimal(value.coefficient, value.scale);
  while (scale > 0 && coefficient % 10n === 0n) { coefficient /= 10n; scale--; }
  return formatDecimal(decimal(coefficient, scale));
}
function scaled(a: Decimal, b: Decimal): readonly [bigint, bigint, number] {
  decimal(a.coefficient, a.scale); decimal(b.coefficient, b.scale); const scale = Math.max(a.scale, b.scale);
  return [a.coefficient * power(scale - a.scale), b.coefficient * power(scale - b.scale), scale];
}
export function add(a: Decimal, b: Decimal): Decimal { const [x, y, scale] = scaled(a, b); return decimal(x + y, scale); }
export function subtract(a: Decimal, b: Decimal): Decimal { const [x, y, scale] = scaled(a, b); return decimal(x - y, scale); }
export function compare(a: Decimal, b: Decimal): -1 | 0 | 1 { const [x, y] = scaled(a, b); return x < y ? -1 : x > y ? 1 : 0; }
function roundDivide(n: bigint, d: bigint, rounding: Rounding): bigint {
  requireThat(d > 0n, 'DIVISION_BY_ZERO'); const q = n / d; const r = n % d;
  if (r === 0n) return q;
  requireThat(rounding !== 'reject', 'ROUNDING_REQUIRED');
  const sign = n < 0n ? -1n : 1n;
  switch (rounding) {
    case 'toward-zero': return q;
    case 'floor': return n < 0n ? q - 1n : q;
    case 'ceil': return n > 0n ? q + 1n : q;
    case 'half-even': {
      const twice = 2n * abs(r);
      return twice > d || (twice === d && abs(q) % 2n === 1n) ? q + sign : q;
    }
  }
}
export function quantize(value: Decimal, scale: number, rounding: Rounding): Decimal {
  decimal(value.coefficient, value.scale); requireThat(scale >= 0 && scale <= MAX_SCALE && Number.isInteger(scale), 'DECIMAL_SCALE');
  return scale >= value.scale ? decimal(value.coefficient * power(scale - value.scale), scale)
    : decimal(roundDivide(value.coefficient, power(value.scale - scale), rounding), scale);
}
export function multiply(a: Decimal, b: Decimal, scale: number, rounding: Rounding): Decimal {
  decimal(a.coefficient, a.scale); decimal(b.coefficient, b.scale); requireThat(Number.isInteger(scale) && scale >= 0 && scale <= MAX_SCALE, 'DECIMAL_SCALE');
  const raw = a.coefficient * b.coefficient; const rawScale = a.scale + b.scale;
  return decimal(rawScale <= scale ? raw * power(scale - rawScale) : roundDivide(raw, power(rawScale - scale), rounding), scale);
}
export function divide(a: Decimal, b: Decimal, scale: number, rounding: Rounding): Decimal {
  decimal(a.coefficient, a.scale); decimal(b.coefficient, b.scale); requireThat(b.coefficient !== 0n, 'DIVISION_BY_ZERO');
  requireThat(Number.isInteger(scale) && scale >= 0 && scale <= MAX_SCALE, 'DECIMAL_SCALE');
  const exponent = scale + b.scale - a.scale;
  const n = a.coefficient * (exponent >= 0 ? power(exponent) : 1n) * (b.coefficient < 0n ? -1n : 1n);
  const d = abs(b.coefficient) * (exponent < 0 ? power(-exponent) : 1n);
  return decimal(roundDivide(n, d, rounding), scale);
}
export type Money = Readonly<{ amount: Decimal; currency: string }>;
export function money(amount: string, currency: string): Money {
  requireThat(/^[A-Z]{3}$/.test(currency), 'CURRENCY_SYNTAX'); return Object.freeze({ amount: parseDecimal(amount), currency });
}
export function addMoney(a: Money, b: Money): Money {
  requireThat(a.currency === b.currency, 'CURRENCY_MISMATCH'); return Object.freeze({ amount: add(a.amount, b.amount), currency: a.currency });
}
/** Largest-remainder allocation, tie-broken by stable IDs, including negative totals. */
export function allocate(total: Decimal, weights: readonly Readonly<{ id: string; weight: Decimal }>[]): Readonly<Record<string, Decimal>> {
  requireThat(weights.length > 0 && weights.length <= 1000 && new Set(weights.map(w => w.id)).size === weights.length, 'ALLOCATION_WEIGHTS');
  for (const w of weights) { requireThat(/^[a-zA-Z0-9_-]{1,64}$/.test(w.id), 'ALLOCATION_ID'); decimal(w.weight.coefficient, w.weight.scale); requireThat(w.weight.coefficient >= 0n, 'NEGATIVE_WEIGHT'); }
  decimal(total.coefficient, total.scale); const scale = Math.max(...weights.map(w => w.weight.scale));
  const integerWeights = weights.map(w => ({ id: w.id, value: w.weight.coefficient * power(scale - w.weight.scale) }));
  const denominator = integerWeights.reduce((sum, w) => sum + w.value, 0n); requireThat(denominator > 0n, 'ZERO_TOTAL_WEIGHT');
  const magnitude = abs(total.coefficient);
  const pieces = integerWeights.map(w => ({ id: w.id, value: magnitude * w.value / denominator, remainder: magnitude * w.value % denominator }));
  let left = magnitude - pieces.reduce((sum, p) => sum + p.value, 0n);
  pieces.sort((a, b) => a.remainder > b.remainder ? -1 : a.remainder < b.remainder ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  for (const piece of pieces) { if (left > 0n) { piece.value++; left--; } }
  requireThat(left === 0n, 'ALLOCATION_CONSERVATION');
  const result: Record<string, Decimal> = Object.create(null) as Record<string, Decimal>;
  for (const piece of pieces) result[piece.id] = decimal(piece.value * (total.coefficient < 0n ? -1n : 1n), total.scale);
  return Object.freeze(result);
}
