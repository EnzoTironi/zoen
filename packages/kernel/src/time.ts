import { requireThat } from './result.js';
export type LocalDate = Readonly<{ kind: 'LocalDate'; iso: string; day: number }>;
export type Instant = Readonly<{ kind: 'Instant'; iso: string; nanoseconds: bigint }>;
function leap(year: number): boolean { return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0); }
function daysBeforeYear(year: number): number { const y = year - 1; return 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400); }
export function localDate(iso: string): LocalDate {
  requireThat(/^\d{4}-\d{2}-\d{2}$/.test(iso), 'DATE_SYNTAX'); const y = Number(iso.slice(0, 4)); const m = Number(iso.slice(5, 7)); const d = Number(iso.slice(8, 10));
  const lengths = [31, leap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  requireThat(y >= 1 && y <= 9999 && m >= 1 && m <= 12 && d >= 1 && d <= lengths[m - 1]!, 'INVALID_DATE');
  const day = daysBeforeYear(y) - daysBeforeYear(1970) + lengths.slice(0, m - 1).reduce((sum, value) => sum + value, 0) + d - 1;
  return Object.freeze({ kind: 'LocalDate', iso, day });
}
/** Canonical protocol is UTC only; timezone conversion is a separate released operation. */
export function instant(iso: string): Instant {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/.exec(iso);
  requireThat(m !== null, 'INSTANT_SYNTAX'); const date = localDate(m[1]!);
  const h = Number(m[2]); const minute = Number(m[3]); const s = Number(m[4]); const fraction = (m[5] ?? '').padEnd(9, '0');
  requireThat(h <= 23 && minute <= 59 && s <= 59, 'INVALID_CLOCK_TIME');
  const nanoseconds = (BigInt(date.day) * 86400n + BigInt(h * 3600 + minute * 60 + s)) * 1_000_000_000n + BigInt(fraction);
  return Object.freeze({ kind: 'Instant', iso: `${m[1]}T${m[2]}:${m[3]}:${m[4]}.${fraction}Z`, nanoseconds });
}
export type TimePoint = LocalDate | Instant;
export type Interval = Readonly<{ kind: 'known'; from: TimePoint; until: TimePoint | null }> | Readonly<{ kind: 'unknown' }>;
function ordinal(point: TimePoint): bigint { return point.kind === 'Instant' ? point.nanoseconds : BigInt(point.day); }
export function compareTime(a: TimePoint, b: TimePoint): -1 | 0 | 1 {
  requireThat(a.kind === b.kind, 'TIME_KIND_MISMATCH'); const x = ordinal(a); const y = ordinal(b); return x < y ? -1 : x > y ? 1 : 0;
}
export function interval(from: TimePoint, until: TimePoint | null): Interval {
  requireThat(until === null || (from.kind === until.kind && compareTime(from, until) < 0), 'INVALID_INTERVAL'); return Object.freeze({ kind: 'known', from, until });
}
export function contains(window: Interval, at: TimePoint): boolean {
  if (window.kind === 'unknown') return false;
  return compareTime(window.from, at) <= 0 && (window.until === null || compareTime(at, window.until) < 0);
}
export function overlaps(a: Interval, b: Interval): boolean {
  if (a.kind === 'unknown' || b.kind === 'unknown') return false;
  requireThat(a.from.kind === b.from.kind, 'TIME_KIND_MISMATCH');
  return (a.until === null || compareTime(b.from, a.until) < 0) && (b.until === null || compareTime(a.from, b.until) < 0);
}
export function sameInterval(a: Interval, b: Interval): boolean {
  if (a.kind === 'unknown' || b.kind === 'unknown') return false;
  if (a.from.kind !== b.from.kind || compareTime(a.from, b.from) !== 0) return false;
  return a.until === null ? b.until === null : b.until !== null && compareTime(a.until, b.until) === 0;
}
