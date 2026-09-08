import { WorldErasurePhase } from "@zoen/contracts/erasure/values";
import { NotFoundOrDenied, Unavailable } from "@zoen/contracts/worlds/errors";
import { Revision } from "@zoen/contracts/worlds/values";
import type { WorldRef } from "@zoen/contracts/worlds/values";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { requireControllerAlignedContent } from "../../erasure/controller-gate.js";
import { requireRestoreAlignedContent } from "../../erasure/restore-activation.js";

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
 * ZA-11: always consults ErasureAttemptRegister controller knowledge via the
 * shared gate. Restoring a pre-Closing application snapshot cannot reopen
 * content while the controller still exposes a blocking attempt. Composition
 * must provide the register (unqualified observeWorld → Clear).
 *
 * ZA-13: ErasureRestoreActivation gates restored installs. Quarantine denies
 * content until promotion; unqualified restoreAfterErasure stays false.
 */
export const admitWorldContent = Effect.fn(
  "authority.access.admitWorldContent"
)(function* admitWorldContent(world: WorldRef, principalId: string) {
  yield* requireControllerAlignedContent(world);
  // ZA-13: restored installs stay quarantined until promotion; rights independent of login.
  yield* requireRestoreAlignedContent(world, principalId);

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
