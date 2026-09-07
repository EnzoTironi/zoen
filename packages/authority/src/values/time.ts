import { InvalidInput } from "@zoen/contracts/worlds/errors";
import {
  DateInterval,
  InstantInterval,
  UnknownTime,
} from "@zoen/contracts/worlds/values";
import { Effect, Schema } from "effect";

const Interval = Schema.Union([DateInterval, InstantInterval, UnknownTime]);
export type Interval = typeof Interval.Type;
export type IntervalRelation =
  | "Overlapping"
  | "Disjoint"
  | "Unknown"
  | "NotComparable";

/** Half-open intervals; civil days and UTC instants never convert implicitly. */
export const intervalRelation = (
  left: Interval,
  right: Interval
): Effect.Effect<IntervalRelation, InvalidInput> =>
  Effect.gen(function* compareIntervals() {
    const first = yield* Schema.decodeEffect(Interval)(left);
    const second = yield* Schema.decodeEffect(Interval)(right);
    if (first._tag === "Unknown" || second._tag === "Unknown") {
      return "Unknown";
    }
    if (first._tag !== second._tag) {
      return "NotComparable";
    }
    return first.from < second.to && second.from < first.to
      ? "Overlapping"
      : "Disjoint";
  }).pipe(
    Effect.catchTag("SchemaError", () =>
      Effect.fail(new InvalidInput({ code: "INVALID_INPUT" }))
    )
  );
