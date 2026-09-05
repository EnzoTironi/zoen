import {
  Blocked,
  NotFoundOrDenied,
  Unavailable,
} from "@zoen/contracts/d01/errors";
import { Revision, exact } from "@zoen/contracts/d01/values";
import type { WorldRef } from "@zoen/contracts/d01/values";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { Head } from "../ports/d01/basis.js";
import { DataPolicy } from "../ports/d01/context.js";
import type { VerifiedRequestContext } from "../ports/d01/context.js";
import { validateContext } from "./context.js";

const AccessRow = Schema.Struct({
  cell_epoch: Revision,
  cell_id: Schema.String.check(Schema.isUUID()),
  data_policy_id: Schema.String,
  emergency_deny: Schema.Boolean,
  generation_id: Schema.String.check(Schema.isUUID()),
  membership_revision: Revision,
  release_digest: Head.fields.releaseDigest,
  role: Schema.Literal("owner"),
  security_revision: Revision,
  state: Schema.Literals(["active", "revoked"]),
}).annotate(exact);

export const authorizeWorld = Effect.fn("authority.access.authorizeWorld")(
  function* authorizeWorld(context: VerifiedRequestContext, world: WorldRef) {
    yield* validateContext(context);
    if (world.realm !== context.presence.realm) {
      return yield* new NotFoundOrDenied({ code: "NOT_FOUND_OR_DENIED" });
    }
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql`
      SELECT w.cell_id, w.cell_epoch::text, w.release_digest, w.generation_id,
        w.security_revision::text, w.emergency_deny, w.data_policy_id,
        m.state, m.role, m.revision::text AS membership_revision
      FROM authority.worlds w
      JOIN authority.memberships m USING (world_id, realm)
      WHERE w.world_id = ${world.worldId} AND w.realm = ${world.realm}
        AND m.principal_id = ${context.presence.principalId}
    `;
    const [row] = rows;
    if (row === undefined) {
      return yield* new NotFoundOrDenied({ code: "NOT_FOUND_OR_DENIED" });
    }
    const access = yield* Schema.decodeUnknownEffect(AccessRow)(row).pipe(
      Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
    );
    if (access.state !== "active" || access.emergency_deny) {
      return yield* new NotFoundOrDenied({ code: "NOT_FOUND_OR_DENIED" });
    }
    const policy = yield* DataPolicy;
    if (access.data_policy_id !== policy.profileId) {
      return yield* new Blocked({ code: "PROFILE_BLOCKED" });
    }
    return access;
  }
);
