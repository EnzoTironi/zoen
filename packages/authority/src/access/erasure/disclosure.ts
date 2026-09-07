import { Unavailable } from "@zoen/contracts/worlds/errors";
import type { WorldRef } from "@zoen/contracts/worlds/values";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import {
  membershipDisclosureKey,
  worldDisclosureKey,
} from "../../ports/disclosure/keys.js";
import { PrincipalId } from "../../ports/worlds/context.js";

/**
 * Inside Closing's SERIALIZABLE mutation, after the membership-domain lock.
 * One world-level exclusive advisory lock coordinates against emitters; subject
 * bumps and pending checks are set-based so membership cardinality cannot blow
 * the request deadline. A durable unacknowledged emission cannot be cleared by
 * timeout or process death.
 */
export const fenceWorldDisclosures = Effect.fn(
  "authority.erasure.fenceWorldDisclosures"
)(function* fenceWorldDisclosures(world: WorldRef) {
  const sql = yield* SqlClient.SqlClient;
  const worldKey = worldDisclosureKey(world);
  yield* sql`
    SELECT pg_try_advisory_xact_lock(hashtextextended(${worldKey}, 0)) AS held
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
    INSERT INTO jobs.disclosure_subjects (subject_key, revision) VALUES (${worldKey}, 0)
    ON CONFLICT (subject_key) DO UPDATE
      SET revision = jobs.disclosure_subjects.revision + 1
  `;
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
  const keys = memberships.map((membership) =>
    membershipDisclosureKey(world, membership.principal_id)
  );
  if (keys.length !== 0) {
    yield* sql`
      INSERT INTO jobs.disclosure_subjects ${sql.insert(
        keys.map((subject_key) => ({ revision: 0, subject_key }))
      )}
      ON CONFLICT (subject_key) DO UPDATE
        SET revision = jobs.disclosure_subjects.revision + 1
    `;
    const pending = yield* sql`
      SELECT permit_id FROM jobs.disclosure_pending
      WHERE ${sql.in("membership_key", keys)}
      LIMIT 1
    `;
    if (pending.length !== 0) {
      return yield* new Unavailable({ code: "UNAVAILABLE" });
    }
  }
  return yield* Effect.void;
});
