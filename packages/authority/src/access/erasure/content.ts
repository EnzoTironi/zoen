import { WorldErasurePhase } from "@zoen/contracts/erasure/values";
import { NotFoundOrDenied, Unavailable } from "@zoen/contracts/worlds/errors";
import { Revision } from "@zoen/contracts/worlds/values";
import type { WorldRef } from "@zoen/contracts/worlds/values";
import { Effect, Option, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import {
  ErasureAttemptRegister,
  blocksWorldContentAdmission,
} from "../../ports/erasure/attempt-register.js";

const ProgressAdmission = Schema.Struct({
  erasure_revision: Revision,
  phase: WorldErasurePhase,
});

/**
 * World content barrier under SERIALIZABLE: FOR SHARE the progress row (or the
 * absence predicate), refuse non-Active phases, and return the admitted epoch.
 * Callers bind capture/publication work to this epoch; caller-supplied
 * generations never authorize admission.
 *
 * ZA-11: when an ErasureAttemptRegister is in context, also consult independent
 * controller knowledge. Restoring a pre-Closing application snapshot cannot
 * reopen content while the controller still exposes a blocking attempt.
 * Absent register (optional) keeps prior local-progress-only behavior.
 */
export const admitWorldContent = Effect.fn(
  "authority.access.admitWorldContent"
)(function* admitWorldContent(world: WorldRef) {
  const maybeRegister = yield* Effect.serviceOption(ErasureAttemptRegister);
  if (Option.isSome(maybeRegister)) {
    const suppression = yield* maybeRegister.value.observeWorld(world);
    if (blocksWorldContentAdmission(suppression)) {
      return yield* new NotFoundOrDenied({ code: "NOT_FOUND_OR_DENIED" });
    }
  }

  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql`
      SELECT phase, erasure_revision::text
      FROM authority.world_erasure_progress
      WHERE world_id = ${world.worldId} AND realm = ${world.realm}
      FOR SHARE
    `;
  if (rows.length > 1) {
    return yield* new Unavailable({ code: "UNAVAILABLE" });
  }
  if (rows.length === 0) {
    return yield* Schema.decodeEffect(Revision)("0").pipe(
      Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
    );
  }
  const progress = yield* Schema.decodeUnknownEffect(ProgressAdmission)(
    rows[0]
  ).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));
  if (progress.phase !== "Active") {
    // Do not disclose whether the World is Closing, Erased, or administratively blocked.
    return yield* new NotFoundOrDenied({ code: "NOT_FOUND_OR_DENIED" });
  }
  return progress.erasure_revision;
});
