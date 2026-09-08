import { WorldErasureInspected } from "@zoen/contracts/erasure/operations";
import type { InspectWorldErasure } from "@zoen/contracts/erasure/operations";
import { WorldErasurePhase } from "@zoen/contracts/erasure/values";
import { Blocked, Unavailable } from "@zoen/contracts/worlds/errors";
import { OperationId, Revision, exact } from "@zoen/contracts/worlds/values";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { authorizeWorld } from "../../access/world.js";
import { AuthorityInstallation } from "../../commit/configuration.js";
import { ErasureAttemptRegister } from "../../ports/erasure/attempt-register.js";
import type { VerifiedRequestContext } from "../../ports/worlds/context.js";
import { DataPolicy, DataPolicySchema } from "../../ports/worlds/context.js";
import { requireErasablePolicy } from "../policy.js";

const ProgressRow = Schema.Struct({
  closing_operation_id: Schema.NullOr(OperationId),
  erasure_revision: Revision,
  phase: WorldErasurePhase,
  policy_version: Schema.NullOr(Schema.String),
}).annotate(exact);

/** Narrow administrative progress after Closing — not content disclosure. */
export const inspectWorldErasure = Effect.fn("erasure.inspectWorldErasure")(
  function* inspectWorldErasure(
    context: VerifiedRequestContext,
    request: typeof InspectWorldErasure.Type
  ) {
    const policy = yield* Schema.decodeEffect(DataPolicySchema)(
      yield* DataPolicy
    ).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));
    yield* authorizeWorld(context, request.worldRef, "erasure");
    if (!policy.erasure) {
      return yield* new Blocked({ code: "PROFILE_BLOCKED" });
    }
    yield* requireErasablePolicy(policy.profileId);

    const sql = yield* SqlClient.SqlClient;
    const world = request.worldRef;
    const [progress] = yield* sql`
      SELECT phase, erasure_revision::text, closing_operation_id, policy_version
      FROM authority.world_erasure_progress
      WHERE world_id = ${world.worldId} AND realm = ${world.realm}
    `;
    const current =
      progress === undefined
        ? {
            closing_operation_id: null,
            erasure_revision: "0",
            phase: "Active" as const,
            policy_version: null,
          }
        : yield* Schema.decodeUnknownEffect(ProgressRow)(progress).pipe(
            Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
          );

    if (
      request.input.operationId !== null &&
      current.closing_operation_id !== null &&
      request.input.operationId !== current.closing_operation_id
    ) {
      return yield* new Unavailable({ code: "UNAVAILABLE" });
    }

    let attemptExternalState:
      | "Registered"
      | "Confirmed"
      | "Aborted"
      | "Unknown" = "Unknown";
    if (current.closing_operation_id !== null) {
      const installation = yield* AuthorityInstallation;
      const register = yield* ErasureAttemptRegister;
      const observed = yield* register.inspect({
        deploymentEpoch: `cell:${installation.cellId}:epoch:${installation.cellEpoch}`,
        operationId: current.closing_operation_id,
        principalId: context.presence.principalId,
        worldRef: world,
      });
      attemptExternalState = observed.state;
    }

    return yield* Schema.decodeEffect(WorldErasureInspected)({
      _tag: "WorldErasureInspected",
      attemptExternalState,
      phase: current.phase,
      restoreAfterErasure: false,
      revision: current.erasure_revision,
      worldRef: world,
    }).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));
  }
);
