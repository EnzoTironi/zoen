import { fail, ok, requireThat, toPublicFailure, type Result } from './result.js';

export type LocalDate = Readonly<{ kind: 'LocalDate'; iso: string; day: number }>;
export type Instant = Readonly<{ kind: 'Instant'; iso: string; nanoseconds: bigint }>;

function leap(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
function daysBeforeYear(year: number): number {
  const y = year - 1;
  return 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400);
}

function catching<T>(fn: () => T): Result<T> {
  try {
    return ok(fn());
  } catch (error) {
    return toPublicFailure(error);
  }
}

export function localDate(iso: string): LocalDate {
  requireThat(/^\d{4}-\d{2}-\d{2}$/.test(iso), 'DATE_SYNTAX');
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  const lengths = [31, leap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  requireThat(y >= 1 && y <= 9999 && m >= 1 && m <= 12 && d >= 1 && d <= lengths[m - 1]!, 'INVALID_DATE');
  const day = daysBeforeYear(y) - daysBeforeYear(1970) + lengths.slice(0, m - 1).reduce((sum, value) => sum + value, 0) + d - 1;
  return Object.freeze({ kind: 'LocalDate', iso, day });
}

/** Canonical protocol is UTC only; timezone conversion is a separate released operation. */
export function instant(iso: string): Instant {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/.exec(iso);
  requireThat(m !== null, 'INSTANT_SYNTAX');
  const date = localDate(m[1]!);
  const h = Number(m[2]);
  const minute = Number(m[3]);
  const s = Number(m[4]);
  const fraction = (m[5] ?? '').padEnd(9, '0');
  requireThat(h <= 23 && minute <= 59 && s <= 59, 'INVALID_CLOCK_TIME');
  const nanoseconds = (BigInt(date.day) * 86400n + BigInt(h * 3600 + minute * 60 + s)) * 1_000_000_000n + BigInt(fraction);
  return Object.freeze({ kind: 'Instant', iso: `${m[1]}T${m[2]}:${m[3]}:${m[4]}.${fraction}Z`, nanoseconds });
}

export type TimePoint = LocalDate | Instant;
export type Interval = Readonly<{ kind: 'known'; from: TimePoint; until: TimePoint | null }> | Readonly<{ kind: 'unknown' }>;

function ordinal(point: TimePoint): bigint {
  return point.kind === 'Instant' ? point.nanoseconds : BigInt(point.day);
}

export function compareTime(a: TimePoint, b: TimePoint): -1 | 0 | 1 {
  requireThat(a.kind === b.kind, 'TIME_KIND_MISMATCH');
  const x = ordinal(a);
  const y = ordinal(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

export function interval(from: TimePoint, until: TimePoint | null): Interval {
  requireThat(until === null || (from.kind === until.kind && compareTime(from, until) < 0), 'INVALID_INTERVAL');
  return Object.freeze({ kind: 'known', from, until });
}

export function unknownInterval(): Interval {
  return Object.freeze({ kind: 'unknown' });
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

export type ComparableInterval = Readonly<{ tag: 'Comparable'; order: -1 | 0 | 1 }>;
export type NonComparableInterval = Readonly<{ tag: 'NonComparable'; code: 'TIME_KIND_MISMATCH' | 'UNKNOWN_INTERVAL' }>;
export type IntervalComparison = ComparableInterval | NonComparableInterval;

/** Spec: compareIntervals(a,b) -> ComparableInterval | NonComparable */
export function compareIntervals(a: Interval, b: Interval): IntervalComparison {
  if (a.kind === 'unknown' || b.kind === 'unknown') return Object.freeze({ tag: 'NonComparable', code: 'UNKNOWN_INTERVAL' });
  if (a.from.kind !== b.from.kind) return Object.freeze({ tag: 'NonComparable', code: 'TIME_KIND_MISMATCH' });
  const fromOrder = compareTime(a.from, b.from);
  if (fromOrder !== 0) return Object.freeze({ tag: 'Comparable', order: fromOrder });
  if (a.until === null && b.until === null) return Object.freeze({ tag: 'Comparable', order: 0 });
  if (a.until === null) return Object.freeze({ tag: 'Comparable', order: 1 });
  if (b.until === null) return Object.freeze({ tag: 'Comparable', order: -1 });
  return Object.freeze({ tag: 'Comparable', order: compareTime(a.until, b.until) });
}

export type IntervalIntersection =
  | Readonly<{ tag: 'Ok'; value: Interval }>
  | Readonly<{ tag: 'Empty' }>
  | Readonly<{ tag: 'NonComparable'; code: 'TIME_KIND_MISMATCH' | 'UNKNOWN_INTERVAL' }>;

/** Half-open intersection. Adjacent [a,b) and [b,c) => Empty (no overlap). */
export function intersectIntervals(a: Interval, b: Interval): IntervalIntersection {
  if (a.kind === 'unknown' || b.kind === 'unknown') return Object.freeze({ tag: 'NonComparable', code: 'UNKNOWN_INTERVAL' });
  if (a.from.kind !== b.from.kind) return Object.freeze({ tag: 'NonComparable', code: 'TIME_KIND_MISMATCH' });
  if (!overlaps(a, b)) return Object.freeze({ tag: 'Empty' });
  const from = compareTime(a.from, b.from) >= 0 ? a.from : b.from;
  let until: TimePoint | null;
  if (a.until === null) until = b.until;
  else if (b.until === null) until = a.until;
  else until = compareTime(a.until, b.until) <= 0 ? a.until : b.until;
  if (until !== null && compareTime(from, until) >= 0) return Object.freeze({ tag: 'Empty' });
  return Object.freeze({ tag: 'Ok', value: interval(from, until) });
}

/** Injected decision clock — never read from host timezone/Date.now implicitly. */
export type ClockSample = Readonly<{ kind: 'ClockSample'; at: Instant; source: string }>;
export function clockSample(at: Instant, source: string): ClockSample {
  requireThat(/^[a-z][a-z0-9._-]{0,63}$/.test(source), 'CLOCK_SOURCE');
  return Object.freeze({ kind: 'ClockSample', at, source });
}

/** Valid business time — distinct from recorded commit cut. */
export type ValidTime = Readonly<{ kind: 'ValidTime'; interval: Interval }>;
export type CommitCut = Readonly<{ kind: 'CommitCut'; recordedAt: Instant }>;
export function validTime(intervalValue: Interval): ValidTime {
  return Object.freeze({ kind: 'ValidTime', interval: intervalValue });
}
export function commitCut(recordedAt: Instant): CommitCut {
  return Object.freeze({ kind: 'CommitCut', recordedAt });
}

export type WallTime = Readonly<{ date: LocalDate; hour: number; minute: number; second: number }>;
export function wallTime(dateIso: string, hour: number, minute: number, second = 0): WallTime {
  requireThat(Number.isInteger(hour) && hour >= 0 && hour <= 23, 'INVALID_CLOCK_TIME');
  requireThat(Number.isInteger(minute) && minute >= 0 && minute <= 59, 'INVALID_CLOCK_TIME');
  requireThat(Number.isInteger(second) && second >= 0 && second <= 59, 'INVALID_CLOCK_TIME');
  return Object.freeze({ date: localDate(dateIso), hour, minute, second });
}

export type Disambiguation = 'earlier' | 'later' | 'reject';
export type ZoneOffsetMinutes = number;

/**
 * Released zone transition lookup for one civil wall time.
 * Offsets are minutes east of UTC. Overlap => ambiguous; empty => nonexistent gap.
 */
export type ZoneTransitionLookup = Readonly<{
  zoneId: string;
  wall: WallTime;
  offsetsMinutes: readonly ZoneOffsetMinutes[];
}>;

export type ZonedAppointment = Readonly<{
  kind: 'ZonedAppointment';
  zoneId: string;
  wall: WallTime;
  instant: Instant;
  offsetMinutes: ZoneOffsetMinutes;
  disambiguation: Disambiguation | 'unique' | 'explicit-offset';
}>;

function offsetToInstant(wall: WallTime, offsetMinutes: number): Instant {
  const localSeconds =
    BigInt(wall.date.day) * 86400n + BigInt(wall.hour * 3600 + wall.minute * 60 + wall.second) - BigInt(offsetMinutes * 60);
  const day = localSeconds < 0n ? -((-localSeconds + 86399n) / 86400n) : localSeconds / 86400n;
  let sod = localSeconds - day * 86400n;
  if (sod < 0n) sod += 86400n;
  const h = Number(sod / 3600n);
  const mi = Number((sod % 3600n) / 60n);
  const s = Number(sod % 60n);
  const absDay = Number(day) + daysBeforeYear(1970);
  let year = 1970;
  while (daysBeforeYear(year + 1) <= absDay) year++;
  let rem = absDay - daysBeforeYear(year);
  const lengths = [31, leap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let month = 1;
  while (rem >= lengths[month - 1]!) {
    rem -= lengths[month - 1]!;
    month++;
  }
  const dom = rem + 1;
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(dom).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:${String(s).padStart(2, '0')}.000000000Z`;
  return instant(iso);
}

/**
 * Resolve zoned wall-time using an explicit released lookup — never host TZ.
 * Ambiguous local times require disambiguation or an explicit offset; gaps fail.
 */
export function resolveZonedAppointment(input: {
  lookup: ZoneTransitionLookup;
  disambiguation?: Disambiguation;
  explicitOffsetMinutes?: number;
}): ZonedAppointment {
  const { lookup } = input;
  requireThat(/^[A-Za-z0-9_+\-/]{1,64}$/.test(lookup.zoneId), 'ZONE_ID');
  const offsets = lookup.offsetsMinutes;
  requireThat(offsets.every((o) => Number.isInteger(o) && o >= -18 * 60 && o <= 18 * 60), 'ZONE_OFFSET');
  requireThat(offsets.length > 0, 'NONEXISTENT_LOCAL_TIME');

  if (input.explicitOffsetMinutes !== undefined) {
    requireThat(offsets.includes(input.explicitOffsetMinutes), 'OFFSET_NOT_IN_LOOKUP');
    return Object.freeze({
      kind: 'ZonedAppointment',
      zoneId: lookup.zoneId,
      wall: lookup.wall,
      instant: offsetToInstant(lookup.wall, input.explicitOffsetMinutes),
      offsetMinutes: input.explicitOffsetMinutes,
      disambiguation: 'explicit-offset',
    });
  }

  if (offsets.length === 1) {
    const offset = offsets[0]!;
    return Object.freeze({
      kind: 'ZonedAppointment',
      zoneId: lookup.zoneId,
      wall: lookup.wall,
      instant: offsetToInstant(lookup.wall, offset),
      offsetMinutes: offset,
      disambiguation: 'unique',
    });
  }

  const policy = input.disambiguation ?? 'reject';
  requireThat(policy !== 'reject', 'AMBIGUOUS_LOCAL_TIME');
  // Fall-back overlap: earlier instant uses the larger (more east / less negative) offset.
  const earlierOffset = Math.max(...offsets);
  const laterOffset = Math.min(...offsets);
  const offset = policy === 'earlier' ? earlierOffset : laterOffset;
  return Object.freeze({
    kind: 'ZonedAppointment',
    zoneId: lookup.zoneId,
    wall: lookup.wall,
    instant: offsetToInstant(lookup.wall, offset),
    offsetMinutes: offset,
    disambiguation: policy,
  });
}

export function parseZonedAppointment(input: {
  lookup: ZoneTransitionLookup;
  disambiguation?: Disambiguation;
  explicitOffsetMinutes?: number;
}): Result<ZonedAppointment> {
  return catching(() => resolveZonedAppointment(input));
}

export function parseInstant(value: unknown): Result<Instant> {
  if (typeof value !== 'string') return fail('InvalidInput', 'INSTANT_SYNTAX');
  return catching(() => instant(value));
}

export function parseLocalDate(value: unknown): Result<LocalDate> {
  if (typeof value !== 'string') return fail('InvalidInput', 'DATE_SYNTAX');
  return catching(() => localDate(value));
}

export function decideAt(sample: ClockSample, window: Interval): boolean {
  return contains(window, sample.at);
}
