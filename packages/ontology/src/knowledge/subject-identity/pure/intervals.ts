import type { DateInterval, LocalDate } from "@zoen/contracts/worlds/values";

type Interval = typeof DateInterval.Type;
type CivilDate = typeof LocalDate.Type;

export const overlaps = (left: Interval, right: Interval): boolean =>
  left.from < right.to && right.from < left.to;

export const intersection = (
  left: Interval,
  right: Interval
): Interval | undefined => {
  const from = left.from > right.from ? left.from : right.from;
  const to = left.to < right.to ? left.to : right.to;
  return from < to ? { _tag: "DateInterval", from, to } : undefined;
};

export const covers = (outer: Interval, inner: Interval): boolean =>
  outer.from <= inner.from && inner.to <= outer.to;

/** Inputs are validated civil intervals; touching cuts have no shared instant. */
export const subtractIntervals = (
  original: Interval,
  withdrawals: readonly Interval[]
): readonly Interval[] => {
  let remaining: readonly Interval[] = [original];
  for (const withdrawal of withdrawals) {
    remaining = remaining.flatMap((part) => {
      const overlap = intersection(part, withdrawal);
      if (overlap === undefined) {
        return [part];
      }
      const result: Interval[] = [];
      if (part.from < overlap.from) {
        result.push({
          _tag: "DateInterval",
          from: part.from,
          to: overlap.from,
        });
      }
      if (overlap.to < part.to) {
        result.push({ _tag: "DateInterval", from: overlap.to, to: part.to });
      }
      return result;
    });
  }
  return remaining;
};

/** Maximal union, including adjacent intervals; no calendar arithmetic. */
export const unionIntervals = (
  intervals: readonly Interval[]
): readonly Interval[] => {
  const result: Interval[] = [];
  for (const interval of intervals.toSorted((left, right) => {
    if (left.from === right.from) {
      return 0;
    }
    return left.from < right.from ? -1 : 1;
  })) {
    const previous = result.at(-1);
    if (previous !== undefined && interval.from <= previous.to) {
      result[result.length - 1] = {
        _tag: "DateInterval",
        from: previous.from,
        to: interval.to > previous.to ? interval.to : previous.to,
      };
    } else {
      result.push(interval);
    }
  }
  return result;
};

export const intervalCells = (
  interval: Interval,
  boundaries: readonly CivilDate[]
): readonly Interval[] => {
  const sorted = [
    ...new Set([
      interval.from,
      interval.to,
      ...boundaries.filter(
        (date) => interval.from < date && date < interval.to
      ),
    ]),
  ].toSorted();
  return sorted.flatMap((from, index) => {
    const to = sorted[index + 1];
    return to === undefined
      ? []
      : [{ _tag: "DateInterval" as const, from, to }];
  });
};
