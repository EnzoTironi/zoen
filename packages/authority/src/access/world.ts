import {
  Blocked,
  NotFoundOrDenied,
  Unavailable,
} from "@zoen/contracts/d01/errors";
import type { SemanticRequest } from "@zoen/contracts/d01/operations";
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
  role: Schema.Literals(["owner", "viewer"]),
  security_revision: Revision,
  state: Schema.Literals(["active", "revoked"]),
}).annotate(exact);

const Capability = Schema.Literals(["read", "manage", "mutate"]);
export type WorldCapability = typeof Capability.Type;
const capabilities = {
  AnswerQuestion: "mutate",
  CreatePersonalWorld: "mutate",
  GrantWorldReadAccess: "manage",
  ImportEvidence: "mutate",
  Inspect: "read",
  InspectIdentityRecovery: "read",
  InspectSubjectIdentity: "read",
  InspectWorldAccess: "read",
  InspectWorldErasure: "manage",
  OpenEvidence: "read",
  ProposeCorrection: "mutate",
  ProposeIdentityResolution: "mutate",
  ProposeIdentitySplit: "mutate",
  ProposeIdentityUndo: "mutate",
  RequestWorldErasure: "mutate",
  ResolveIdentity: "mutate",
  RevokeWorldReadAccess: "manage",
  UndoCorrection: "mutate",
} as const satisfies Record<SemanticRequest["operation"], WorldCapability>;
export const operationCapability = (
  operation: SemanticRequest["operation"]
): WorldCapability => capabilities[operation];

export const authorizeWorld = Effect.fn("authority.access.authorizeWorld")(
  function* authorizeWorld(
    context: VerifiedRequestContext,
    world: WorldRef,
    capability: WorldCapability = "mutate"
  ) {
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
    if (
      !Schema.is(Capability)(capability) ||
      access.state !== "active" ||
      access.emergency_deny ||
      (access.role !== "owner" && capability !== "read")
    ) {
      return yield* new NotFoundOrDenied({ code: "NOT_FOUND_OR_DENIED" });
    }
    const policy = yield* DataPolicy;
    if (access.data_policy_id !== policy.profileId) {
      return yield* new Blocked({ code: "PROFILE_BLOCKED" });
    }
    return access;
  }
);
