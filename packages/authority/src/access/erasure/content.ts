import { WorldErasurePhase } from "@zoen/contracts/erasure/values";
import { NotFoundOrDenied, Unavailable } from "@zoen/contracts/worlds/errors";
import type { WorldRef } from "@zoen/contracts/worlds/values";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

/** An absent progress row is the initial state, never a missing-schema fallback. */
export const requireActiveWorldContent = Effect.fn(
  "authority.access.requireActiveWorldContent"
)(function* requireActiveWorldContent(world: WorldRef) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql`
    SELECT phase FROM authority.world_erasure_progress
    WHERE world_id = ${world.worldId} AND realm = ${world.realm}
    FOR SHARE
  `;
  const progress = yield* Schema.decodeUnknownEffect(
    Schema.Array(Schema.Struct({ phase: WorldErasurePhase }))
  )(rows).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));
  if (progress.length > 1) {
    return yield* new Unavailable({ code: "UNAVAILABLE" });
  }
  if (progress.some((row) => row.phase !== "Active")) {
    // Do not disclose whether the World is Closing, Erased, or administratively blocked.
    return yield* new NotFoundOrDenied({ code: "NOT_FOUND_OR_DENIED" });
  }
  return yield* Effect.void;
});
