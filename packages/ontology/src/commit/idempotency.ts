import { Conflict } from "@zoen/contracts/worlds/errors";
import type { Digest } from "@zoen/contracts/worlds/values";
import { Effect } from "effect";

export const requireSameIntent = (
  stored: typeof Digest.Type,
  requested: typeof Digest.Type
): Effect.Effect<void, Conflict> =>
  stored === requested ? Effect.void : new Conflict({ code: "CONFLICT" });
