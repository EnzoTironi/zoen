import {
  ErasureVersionEntry,
  ErasureVersionPurgeOutcome,
} from "@zoen/contracts/erasure/values";
import { Schema } from "effect";

const Outcome = Schema.Struct({
  entry: ErasureVersionEntry,
  outcome: ErasureVersionPurgeOutcome,
});
const identity = (entry: ErasureVersionEntry) =>
  JSON.stringify([
    entry.key,
    entry.versionId,
    entry.deleteMarker,
    entry.isLatest,
  ]);

/** Total bijection, not “no reported failures”; an incomplete response is never Erased. */
export const completePurgeOutcomes = (
  entries: readonly ErasureVersionEntry[],
  outcomes: unknown
): outcomes is readonly (typeof Outcome.Type)[] => {
  if (
    entries.length > 1_000_000 ||
    !Schema.is(Schema.Array(ErasureVersionEntry))(entries) ||
    !Schema.is(Schema.Array(Outcome))(outcomes) ||
    outcomes.length !== entries.length
  ) {
    return false;
  }
  const expected = new Set(entries.map(identity));
  if (expected.size !== entries.length) {
    return false;
  }
  for (const row of outcomes) {
    if (!expected.delete(identity(row.entry))) {
      return false;
    }
  }
  return expected.size === 0;
};
