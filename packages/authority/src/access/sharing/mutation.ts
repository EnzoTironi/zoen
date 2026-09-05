import {
  InvalidInput,
  NotFoundOrDenied,
  Stale,
  Unavailable,
} from "@zoen/contracts/d01/errors";
import { Revision } from "@zoen/contracts/d01/values";
import {
  GrantWorldReadAccess,
  RevokeWorldReadAccess,
  SharingMutationSuccess,
  WorldReadAccessGranted,
  WorldReadAccessRevoked,
} from "@zoen/contracts/sharing/operations";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { bindWorldIntent } from "../../commit/intent.js";
import { commitMutation, readMutationReplay } from "../../commit/mutation.js";
import type { VerifiedRequestContext } from "../../ports/d01/context.js";
import { membershipDisclosureKey } from "../../ports/disclosure/keys.js";
import { PrincipalDirectory } from "../../ports/sharing/directory.js";
import { authorizeWorld } from "../world.js";
import { principalIdFromRef, readMembership } from "./membership.js";

const mutateMembership = Effect.fn("authority.sharing.mutateMembership")(
  function* mutateMembership(
    context: VerifiedRequestContext,
    request:
      | typeof GrantWorldReadAccess.Type
      | typeof RevokeWorldReadAccess.Type
  ) {
    const world = request.worldRef;
    yield* authorizeWorld(context, world, "manage");
    const bound = yield* bindWorldIntent(request);
    const replay = yield* readMutationReplay(context, bound);
    if (replay !== null) {
      return yield* Schema.decodeUnknownEffect(SharingMutationSuccess)(replay);
    }
    const target = yield* principalIdFromRef(request.input.principalRef);
    if (target === context.presence.principalId) {
      return yield* new InvalidInput({ code: "INVALID_INPUT" });
    }
    if (request.operation === "GrantWorldReadAccess") {
      const directory = yield* PrincipalDirectory;
      if (!(yield* directory.exists(target))) {
        return yield* new NotFoundOrDenied({ code: "NOT_FOUND_OR_DENIED" });
      }
    }
    const result = yield* commitMutation(context, bound, {
      apply: (receiptRef) =>
        Effect.gen(function* applyMembership() {
          const sql = yield* SqlClient.SqlClient;
          const key = membershipDisclosureKey(world, target);
          yield* sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
          const current = yield* readMembership(world, target);
          if (current?.role === "owner") {
            return yield* new InvalidInput({ code: "INVALID_INPUT" });
          }
          if (
            current === null &&
            request.operation === "RevokeWorldReadAccess"
          ) {
            return yield* new NotFoundOrDenied({ code: "NOT_FOUND_OR_DENIED" });
          }
          if ((current?.revision ?? null) !== request.input.expectedRevision) {
            return yield* new Stale({ code: "STALE" });
          }
          const state =
            request.operation === "GrantWorldReadAccess" ? "active" : "revoked";
          const changed = current === null || current.state !== state;
          let nextRevision = current?.revision ?? "0";
          if (current !== null && changed) {
            nextRevision = (BigInt(current.revision) + 1n).toString();
          }
          const revision = yield* Schema.decodeEffect(Revision)(nextRevision);
          if (current === null) {
            yield* sql`INSERT INTO authority.memberships (world_id, realm, principal_id, role, state, revision)
            VALUES (${world.worldId}, ${world.realm}, ${target}, 'viewer', ${state}, ${revision})`;
          } else if (changed) {
            yield* sql`UPDATE authority.memberships SET state = ${state}, revision = ${revision}
            WHERE world_id = ${world.worldId} AND realm = ${world.realm} AND principal_id = ${target}`;
          }
          return {
            changedDomains: changed ? ["membership" as const] : [],
            result: yield* Schema.decodeUnknownEffect(SharingMutationSuccess)({
              _tag:
                request.operation === "GrantWorldReadAccess"
                  ? "WorldReadAccessGranted"
                  : "WorldReadAccessRevoked",
              membershipAtCommit: {
                principalRef: request.input.principalRef,
                revision,
                role: "viewer",
                state,
              },
              receiptRef,
              worldRef: world,
            }),
          };
        }).pipe(
          Effect.catchTag(
            "SchemaError",
            () => new Unavailable({ code: "UNAVAILABLE" })
          )
        ),
      basis: null,
      domains: ["membership"],
    });
    return yield* Schema.decodeUnknownEffect(SharingMutationSuccess)(result);
  },
  Effect.catchTag("SchemaError", () => new Unavailable({ code: "UNAVAILABLE" }))
);

export const grantWorldReadAccess = Effect.fn(
  "authority.sharing.grantWorldReadAccess"
)(function* grantWorldReadAccess(
  context: VerifiedRequestContext,
  input: typeof GrantWorldReadAccess.Type
) {
  const request = yield* Schema.decodeEffect(GrantWorldReadAccess)(input).pipe(
    Effect.mapError(() => new InvalidInput({ code: "INVALID_INPUT" }))
  );
  return yield* mutateMembership(context, request).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(WorldReadAccessGranted)),
    Effect.catchTag(
      "SchemaError",
      () => new Unavailable({ code: "UNAVAILABLE" })
    )
  );
});
export const revokeWorldReadAccess = Effect.fn(
  "authority.sharing.revokeWorldReadAccess"
)(function* revokeWorldReadAccess(
  context: VerifiedRequestContext,
  input: typeof RevokeWorldReadAccess.Type
) {
  const request = yield* Schema.decodeEffect(RevokeWorldReadAccess)(input).pipe(
    Effect.mapError(() => new InvalidInput({ code: "INVALID_INPUT" }))
  );
  return yield* mutateMembership(context, request).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(WorldReadAccessRevoked)),
    Effect.catchTag(
      "SchemaError",
      () => new Unavailable({ code: "UNAVAILABLE" })
    )
  );
});
