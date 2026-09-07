import { Unavailable } from "@zoen/contracts/worlds/errors";
import type { WorldRef } from "@zoen/contracts/worlds/values";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { membershipDisclosureKey } from "../../ports/disclosure/keys.js";
import { PrincipalId } from "../../ports/worlds/context.js";

/**
 * Inside Closing's SERIALIZABLE mutation, after the membership-domain lock.
 * Reuses the actual emitter's membership keys; no second coordination database.
 * A durable unacknowledged emission cannot be cleared by timeout or process death.
 */
export const fenceWorldDisclosures = Effect.fn(
  "authority.erasure.fenceWorldDisclosures"
)(function* fenceWorldDisclosures(world: WorldRef) {
  const sql = yield* SqlClient.SqlClient;
  const memberships = yield* sql`
    SELECT principal_id FROM authority.memberships
    WHERE world_id = ${world.worldId} AND realm = ${world.realm}
    ORDER BY principal_id
  `.pipe(
    Effect.flatMap(
      Schema.decodeUnknownEffect(
        Schema.Array(Schema.Struct({ principal_id: PrincipalId }))
      )
    ),
    Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
  );
  for (const membership of memberships) {
    const key = membershipDisclosureKey(world, membership.principal_id);
    yield* sql`
      SELECT pg_try_advisory_xact_lock(hashtextextended(${key}, 0)) AS held
    `.pipe(
      Effect.flatMap(
        Schema.decodeUnknownEffect(
          Schema.Tuple([Schema.Struct({ held: Schema.Literal(true) })])
        )
      ),
      Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
    );
    // Force a serialization failure if a reader committed beyond our snapshot.
    yield* sql`
      INSERT INTO jobs.disclosure_subjects (subject_key, revision) VALUES (${key}, 0)
      ON CONFLICT (subject_key) DO UPDATE
        SET revision = jobs.disclosure_subjects.revision + 1
    `;
    const pending = yield* sql`
      SELECT permit_id FROM jobs.disclosure_pending
      WHERE membership_key = ${key} LIMIT 1
    `;
    if (pending.length !== 0) {
      return yield* new Unavailable({ code: "UNAVAILABLE" });
    }
  }
  return yield* Effect.void;
});
