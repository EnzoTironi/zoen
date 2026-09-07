import { NotFoundOrDenied, Unavailable } from "@zoen/contracts/worlds/errors";
import { VisibleFrame } from "@zoen/contracts/worlds/evidence";
import type { FrameRef, WorldRef } from "@zoen/contracts/worlds/values";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { authorizeWorld } from "../../access/world.js";
import { InternalBasis } from "../../ports/worlds/basis.js";
import type { VerifiedRequestContext } from "../../ports/worlds/context.js";

export const loadCorrectionFrame = Effect.fn("authority.corrections.loadFrame")(
  function* loadCorrectionFrame(
    context: VerifiedRequestContext,
    world: WorldRef,
    frameRef: typeof FrameRef.Type
  ) {
    yield* authorizeWorld(context, world);
    const sql = yield* SqlClient.SqlClient;
    const [row] =
      yield* sql`SELECT internal_basis, visible_frame FROM authority.frames
      WHERE world_id = ${world.worldId} AND realm = ${world.realm} AND frame_id = ${frameRef}
        AND principal_id = ${context.presence.principalId} AND purpose = ${context.purpose}`;
    if (row === undefined) {
      return yield* new NotFoundOrDenied({ code: "NOT_FOUND_OR_DENIED" });
    }
    const saved = yield* Schema.decodeUnknownEffect(
      Schema.Struct({
        internal_basis: InternalBasis,
        visible_frame: VisibleFrame,
      })
    )(row);
    if (
      saved.visible_frame.frameRef !== frameRef ||
      saved.visible_frame.worldRef.worldId !== world.worldId ||
      saved.visible_frame.worldRef.realm !== world.realm
    ) {
      return yield* new Unavailable({ code: "UNAVAILABLE" });
    }
    return saved;
  },
  Effect.catchTag("SchemaError", () => new Unavailable({ code: "UNAVAILABLE" }))
);
