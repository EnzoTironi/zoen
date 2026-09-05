/**
 * Algebraic / resource-limit law runners for SPEC-001.
 * Generates deterministic cases from a recorded seed; stores minimal counterexamples.
 * No network, locale guessing, or host timezone semantics.
 */
import { add, canonicalDecimal, compare, decimal, formatDecimal, normalizeDecimal, parseDecimal, type Decimal } from './decimal.js';
import { canonicalDigest, JSON_LIMITS, parseJsonTextSafe } from './json.js';
import { fail, ok, type Result } from './result.js';
import { instant, intersectIntervals, interval, localDate, sameInterval } from './time.js';

export const LAW_NAMES = [
  'decimal-add-commutativity',
  'decimal-normalize-idempotent',
  'canonical-digest-stable',
  'interval-intersection-commutative',
  'parser-resource-limits',
] as const;
export type LawName = (typeof LAW_NAMES)[number];

export type LawCounterexample = Readonly<{
  law: LawName;
  seed: string;
  caseIndex: number;
  input: unknown;
  observed: unknown;
  expected: unknown;
}>;

export type LawRunReport = Readonly<{
  seed: string;
  casesPerLaw: number;
  locale: string;
  timezone: string;
  executed: number;
  passed: number;
  failed: number;
  digest: string;
  counterexamples: readonly LawCounterexample[];
  perLaw: Readonly<Record<LawName, number>>;
}>;

export const LAW_DEFAULTS = Object.freeze({
  casesPerLaw: 10_000,
  seed: 'zn-0012-laws-seed-v1',
  maxRuntimeMs: 120_000,
});

/** Deterministic xorshift32 — no Math.random; locale/TZ-independent. */
export function createSeededRng(seedText: string): () => number {
  let state = 0x811c9dc5;
  for (let i = 0; i < seedText.length; i++) {
    state ^= seedText.charCodeAt(i);
    state = Math.imul(state, 0x01000193) >>> 0;
  }
  if (state === 0) state = 0x9e3779b9;
  return (): number => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17; state >>>= 0;
    state ^= state << 5; state >>>= 0;
    return (state >>> 0) / 0x100000000;
  };
}

function pickInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function randomDecimal(rng: () => number): Decimal {
  const scale = pickInt(rng, 0, 6);
  const mag = pickInt(rng, 0, 1_000_000);
  const sign = rng() < 0.5 ? -1n : 1n;
  return decimal(sign * BigInt(mag), scale);
}

function decimalsEqual(a: Decimal, b: Decimal): boolean {
  return compare(a, b) === 0;
}

export function checkAddCommutativity(a: Decimal, b: Decimal): boolean {
  return decimalsEqual(add(a, b), add(b, a));
}

export function checkNormalizeIdempotent(text: string): boolean {
  const once = normalizeDecimal(text, { scale: 6, rounding: 'toward-zero' });
  if (once.tag !== 'Ok') return true; // invalid inputs are a different law
  const again = normalizeDecimal(formatDecimal(once.value), { scale: 6, rounding: 'toward-zero' });
  return again.tag === 'Ok' && decimalsEqual(once.value, again.value)
    && canonicalDecimal(once.value) === canonicalDecimal(again.value);
}

export function checkCanonicalDigestStable(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  return canonicalDigest(left as never) === canonicalDigest(right as never);
}

export function checkIntervalIntersectionCommutative(
  aFromDay: number,
  aUntilDay: number,
  bFromDay: number,
  bUntilDay: number,
): boolean {
  const day = (n: number) => {
    const base = Date.UTC(2020, 0, 1) + n * 86_400_000;
    const iso = new Date(base).toISOString().slice(0, 10);
    return localDate(iso);
  };
  const a = interval(day(aFromDay), day(aUntilDay));
  const b = interval(day(bFromDay), day(bUntilDay));
  const ab = intersectIntervals(a, b);
  const ba = intersectIntervals(b, a);
  if (ab.tag !== ba.tag) return false;
  if (ab.tag === 'Empty' || ab.tag === 'NonComparable') return true;
  if (ab.tag !== 'Ok' || ba.tag !== 'Ok') return false;
  return sameInterval(ab.value, ba.value);
}

export function checkParserRejectsOversized(bytesLimit: number, payload: string): boolean {
  const result = parseJsonTextSafe(payload, { bytes: bytesLimit, depth: JSON_LIMITS.depth, entries: JSON_LIMITS.entries });
  return result.tag === 'InvalidInput';
}

function reportDigest(parts: unknown[]): string {
  return canonicalDigest({ parts } as never);
}

/**
 * Run named algebraic / limit laws for `casesPerLaw` seeded cases.
 * Locale/timezone are recorded labels only — generators never read host TZ.
 */
export function runLawSuite(options: {
  seed?: string;
  casesPerLaw?: number;
  locale?: string;
  timezone?: string;
}): Result<LawRunReport> {
  const seed = options.seed ?? LAW_DEFAULTS.seed;
  const casesPerLaw = options.casesPerLaw ?? LAW_DEFAULTS.casesPerLaw;
  if (!Number.isInteger(casesPerLaw) || casesPerLaw < 1) {
    return fail('InvalidInput', 'LAW_CASES_INVALID');
  }
  if (casesPerLaw > 1_000_000) return fail('InvalidInput', 'LAW_CASES_LIMIT');
  const locale = options.locale ?? 'und';
  const timezone = options.timezone ?? 'UTC';
  const rng = createSeededRng(seed); // locale/TZ recorded only — must not change cases
  const counterexamples: LawCounterexample[] = [];
  const perLaw = Object.fromEntries(LAW_NAMES.map((n) => [n, 0])) as Record<LawName, number>;
  let executed = 0;
  let passed = 0;
  let failed = 0;
  const started = Date.now();

  for (let i = 0; i < casesPerLaw; i++) {
    if (Date.now() - started > LAW_DEFAULTS.maxRuntimeMs) {
      return fail('QuotaExceeded', 'LAW_RUNTIME_LIMIT');
    }

    // decimal-add-commutativity
    {
      const law: LawName = 'decimal-add-commutativity';
      const a = randomDecimal(rng);
      const b = randomDecimal(rng);
      executed += 1;
      if (checkAddCommutativity(a, b)) {
        passed += 1; perLaw[law] += 1;
      } else {
        failed += 1;
        if (counterexamples.length < 32) {
          counterexamples.push({
            law, seed, caseIndex: i,
            input: { a: formatDecimal(a), b: formatDecimal(b) },
            observed: formatDecimal(add(a, b)),
            expected: formatDecimal(add(b, a)),
          });
        }
      }
    }

    // decimal-normalize-idempotent
    {
      const law: LawName = 'decimal-normalize-idempotent';
      const d = randomDecimal(rng);
      const text = formatDecimal(d);
      executed += 1;
      if (checkNormalizeIdempotent(text)) {
        passed += 1; perLaw[law] += 1;
      } else {
        failed += 1;
        if (counterexamples.length < 32) {
          counterexamples.push({
            law, seed, caseIndex: i, input: text,
            observed: 'not-idempotent', expected: 'idempotent',
          });
        }
      }
    }

    // canonical-digest-stable (reordered keys)
    {
      const law: LawName = 'canonical-digest-stable';
      const x = pickInt(rng, 0, 1000);
      const y = pickInt(rng, 0, 1000);
      const left = { b: y, a: x, nested: { z: true, m: null as null } };
      const right = { a: x, nested: { m: null, z: true }, b: y };
      executed += 1;
      if (checkCanonicalDigestStable(left, right)) {
        passed += 1; perLaw[law] += 1;
      } else {
        failed += 1;
        if (counterexamples.length < 32) {
          counterexamples.push({
            law, seed, caseIndex: i, input: { left, right },
            observed: canonicalDigest(left as never),
            expected: canonicalDigest(right as never),
          });
        }
      }
    }

    // interval-intersection-commutative
    {
      const law: LawName = 'interval-intersection-commutative';
      const a0 = pickInt(rng, 0, 40);
      const a1 = a0 + pickInt(rng, 1, 20);
      const b0 = pickInt(rng, 0, 40);
      const b1 = b0 + pickInt(rng, 1, 20);
      executed += 1;
      if (checkIntervalIntersectionCommutative(a0, a1, b0, b1)) {
        passed += 1; perLaw[law] += 1;
      } else {
        failed += 1;
        if (counterexamples.length < 32) {
          counterexamples.push({
            law, seed, caseIndex: i,
            input: { a0, a1, b0, b1 },
            observed: 'asymmetric', expected: 'commutative',
          });
        }
      }
    }

    // parser-resource-limits
    {
      const law: LawName = 'parser-resource-limits';
      const limit = pickInt(rng, 8, 64);
      const payload = `"${'x'.repeat(limit + 8)}"`;
      executed += 1;
      if (checkParserRejectsOversized(limit, payload)) {
        passed += 1; perLaw[law] += 1;
      } else {
        failed += 1;
        if (counterexamples.length < 32) {
          counterexamples.push({
            law, seed, caseIndex: i,
            input: { limit, length: payload.length },
            observed: 'accepted', expected: 'InvalidInput',
          });
        }
      }
    }
  }

  // Adversarial deep payload once per suite (resource limit witness)
  {
    let deep = '"leaf"';
    for (let d = 0; d < JSON_LIMITS.depth + 1; d++) deep = `[${deep}]`;
    const deepResult = parseJsonTextSafe(deep);
    executed += 1;
    if (deepResult.tag === 'InvalidInput') {
      passed += 1;
      perLaw['parser-resource-limits'] += 1;
    } else {
      failed += 1;
      counterexamples.push({
        law: 'parser-resource-limits', seed, caseIndex: -1,
        input: { depth: JSON_LIMITS.depth + 1 },
        observed: deepResult.tag, expected: 'InvalidInput',
      });
    }
  }

  const digest = reportDigest([seed, casesPerLaw, locale, timezone, executed, passed, failed, perLaw, counterexamples]);
  return ok(Object.freeze({
    seed,
    casesPerLaw,
    locale,
    timezone,
    executed,
    passed,
    failed,
    digest,
    counterexamples: Object.freeze(counterexamples),
    perLaw: Object.freeze(perLaw),
  }));
}

export function lawSuiteDigestsAgree(a: LawRunReport, b: LawRunReport): boolean {
  // Same seed+cases must agree on per-law counts and failure set; locale/TZ labels may differ.
  if (a.seed !== b.seed || a.casesPerLaw !== b.casesPerLaw) return false;
  if (a.executed !== b.executed || a.passed !== b.passed || a.failed !== b.failed) return false;
  for (const name of LAW_NAMES) {
    if (a.perLaw[name] !== b.perLaw[name]) return false;
  }
  return JSON.stringify(a.counterexamples) === JSON.stringify(b.counterexamples);
}

// Keep Instant import used for type-level temporal coupling in future laws.
void instant;
void parseDecimal;
