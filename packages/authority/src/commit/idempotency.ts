import { Conflict } from "@zoen/contracts/d01/errors";
import type { Digest } from "@zoen/contracts/d01/values";
import { Effect } from "effect";

export const requireSameIntent = (
  stored: typeof Digest.Type,
  requested: typeof Digest.Type
): Effect.Effect<void, Conflict> =>
  stored === requested ? Effect.void : new Conflict({ code: "CONFLICT" });
