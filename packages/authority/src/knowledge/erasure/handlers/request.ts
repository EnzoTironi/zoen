import { WorldErasureRequested } from "@zoen/contracts/erasure/operations";
import type { RequestWorldErasure } from "@zoen/contracts/erasure/operations";
import { WorldErasurePhase } from "@zoen/contracts/erasure/values";
import { Conflict, Stale, Unavailable } from "@zoen/contracts/worlds/errors";
import { Revision, exact } from "@zoen/contracts/worlds/values";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { fenceWorldDisclosures } from "../../../access/erasure/disclosure.js";
import { authorizeWorld } from "../../../access/world.js";
import { AuthorityInstallation } from "../../../commit/configuration.js";
import { bindWorldIntent } from "../../../commit/intent.js";
import {
  commitMutation,
  readMutationReplay,
} from "../../../commit/mutation.js";
import type { ErasureAttemptIdentity } from "../../../ports/erasure/attempt-register.js";
import { ErasureAttemptRegister } from "../../../ports/erasure/attempt-register.js";
import type { VerifiedRequestContext } from "../../../ports/worlds/context.js";
import { requireErasablePolicy } from "../policy.js";

const ProgressRow = Schema.Struct({
  closing_operation_id: Schema.NullOr(Schema.String.check(Schema.isUUID())),
  closing_receipt_id: Schema.NullOr(Schema.String.check(Schema.isUUID())),
  erasure_revision: Revision,
  phase: WorldErasurePhase,
  policy_version: Schema.NullOr(Schema.String),
}).annotate(exact);

const deploymentEpochOf = (installation: {
  readonly cellEpoch: string;
  readonly cellId: string;
}) => `cell:${installation.cellId}:epoch:${installation.cellEpoch}`;

const identityOf = (
  context: VerifiedRequestContext,
  request: typeof RequestWorldErasure.Type,
  installation: { readonly cellEpoch: string; readonly cellId: string }
): ErasureAttemptIdentity => ({
  deploymentEpoch: deploymentEpochOf(installation),
  operationId: request.operationId,
  principalId: context.presence.principalId,
  worldRef: request.worldRef,
});

const disclosed = (
  result: typeof WorldErasureRequested.Type
): typeof WorldErasureRequested.Type => ({
  ...result,
  attemptExternalState: "Confirmed",
  restoreAfterErasure: false,
});

/**
 * Register existence first (F01), then atomic local Closing+receipt+outbox (F05).
 * Success is disclosed only after the register mirrors Confirmada.
 */
export const requestWorldErasure = Effect.fn("erasure.requestWorldErasure")(
  function* requestWorldErasure(
    context: VerifiedRequestContext,
    request: typeof RequestWorldErasure.Type
  ) {
    if (!request.input.confirmEntireWorld) {
      return yield* new Conflict({ code: "CONFLICT" });
    }
    yield* requireErasablePolicy(request.input.policyVersion);
    yield* authorizeWorld(context, request.worldRef, "erasure");
    const installation = yield* AuthorityInstallation;
    const register = yield* ErasureAttemptRegister;
    const identity = identityOf(context, request, installation);
    const intention = {
      confirmEntireWorld: true as const,
      expectedErasureRevision: request.input.expectedErasureRevision,
      policyVersion: request.input.policyVersion,
    };

    const registered = yield* register.register(identity, intention);
    if (registered.state !== "Registered" && registered.state !== "Confirmed") {
      // Unknown / lost outcome: do not Closing; stay Unavailable (F06).
      return yield* new Unavailable({ code: "UNAVAILABLE" });
    }

    const bound = yield* bindWorldIntent(request);
    const replay = yield* readMutationReplay(context, bound);
    if (replay !== null) {
      const prior = yield* Schema.decodeUnknownEffect(WorldErasureRequested)(
        replay
      ).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));
      const observed = yield* register.inspect(identity);
      if (observed.state !== "Confirmed") {
        if (observed.state === "Registered") {
          const mirrored = yield* register.mirrorLocalOutcome(
            identity,
            "Confirmed"
          );
          if (mirrored.state !== "Confirmed") {
            return yield* new Unavailable({ code: "UNAVAILABLE" });
          }
        } else {
          return yield* new Unavailable({ code: "UNAVAILABLE" });
        }
      }
      return disclosed(prior);
    }

    if (registered.state === "Confirmed") {
      // Register already terminal without local Closing receipt → conflict surface.
      return yield* new Conflict({ code: "CONFLICT" });
    }

    const closingOutcome = yield* Effect.result(
      commitMutation(context, bound, {
        apply: (receiptRef) =>
          Effect.gen(function* applyClosing() {
            const sql = yield* SqlClient.SqlClient;
            const world = request.worldRef;
            yield* sql`
            SELECT world_id FROM authority.worlds
            WHERE world_id = ${world.worldId} AND realm = ${world.realm}
            FOR UPDATE
          `;
            // Identity write so a reservation waiting on FOR SHARE cannot keep a
            // pre-Closing snapshot after we commit (SSI aborts the stale reader).
            yield* sql`
            UPDATE authority.worlds
            SET security_revision = security_revision
            WHERE world_id = ${world.worldId} AND realm = ${world.realm}
          `;
            yield* fenceWorldDisclosures(world);
            const [progress] = yield* sql`
            SELECT phase, erasure_revision::text, closing_operation_id,
              closing_receipt_id, policy_version
            FROM authority.world_erasure_progress
            WHERE world_id = ${world.worldId} AND realm = ${world.realm}
            FOR UPDATE
          `;
            const current =
              progress === undefined
                ? {
                    closing_operation_id: null,
                    closing_receipt_id: null,
                    erasure_revision: "0",
                    phase: "Active" as const,
                    policy_version: null,
                  }
                : yield* Schema.decodeUnknownEffect(ProgressRow)(progress).pipe(
                    Effect.mapError(
                      () => new Unavailable({ code: "UNAVAILABLE" })
                    )
                  );
            if (current.phase !== "Active") {
              if (
                current.closing_operation_id === request.operationId &&
                current.closing_receipt_id !== null
              ) {
                return yield* new Unavailable({ code: "UNAVAILABLE" });
              }
              return yield* new Conflict({ code: "CONFLICT" });
            }
            const expected = request.input.expectedErasureRevision;
            const matches =
              expected === null
                ? current.erasure_revision === "0"
                : expected === current.erasure_revision;
            if (!matches) {
              return yield* new Stale({ code: "STALE" });
            }
            const nextRevision = yield* Schema.decodeEffect(Revision)(
              (BigInt(current.erasure_revision) + 1n).toString()
            ).pipe(
              Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
            );
            yield* progress === undefined
              ? sql`
              INSERT INTO authority.world_erasure_progress (
                world_id, realm, phase, erasure_revision,
                closing_operation_id, closing_receipt_id, policy_version
              ) VALUES (
                ${world.worldId}, ${world.realm}, ${"Closing"}, ${nextRevision},
                ${request.operationId}, ${receiptRef}, ${request.input.policyVersion}
              )
            `
              : sql`
              UPDATE authority.world_erasure_progress
              SET phase = ${"Closing"},
                  erasure_revision = ${nextRevision},
                  closing_operation_id = ${request.operationId},
                  closing_receipt_id = ${receiptRef},
                  policy_version = ${request.input.policyVersion},
                  updated_at = clock_timestamp()
              WHERE world_id = ${world.worldId} AND realm = ${world.realm}
                AND phase = ${"Active"}
            `;
            yield* sql`
            INSERT INTO authority.world_erasure_receipts (
              world_id, realm, operation_id, principal_id, receipt_id,
              intention_digest, policy_version, erasure_revision
            ) VALUES (
              ${world.worldId}, ${world.realm}, ${request.operationId},
              ${context.presence.principalId}, ${receiptRef},
              ${bound.digest}, ${request.input.policyVersion}, ${nextRevision}
            )
          `;
            const stored = yield* Schema.decodeEffect(WorldErasureRequested)({
              _tag: "WorldErasureRequested",
              attemptExternalState: "Registered",
              phase: "Closing",
              policyVersion: request.input.policyVersion,
              receiptRef,
              restoreAfterErasure: false,
              revision: nextRevision,
              worldRef: world,
            }).pipe(
              Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
            );
            return { changedDomains: [], result: stored };
          }),
        basis: null,
        domains: ["membership"],
      })
    );
    if (closingOutcome._tag === "Failure") {
      // Proved non-erasure local outcome (live emission, conflict, stale, …):
      // mirror Abort so content is not wedged Registered (F01/F06).
      const aborted = yield* register.mirrorLocalOutcome(identity, "Aborted");
      if (aborted.state !== "Aborted" && aborted.state !== "Unknown") {
        return yield* new Unavailable({ code: "UNAVAILABLE" });
      }
      return yield* closingOutcome.failure;
    }
    const result = closingOutcome.success;

    const closed = yield* Schema.decodeUnknownEffect(WorldErasureRequested)(
      result
    ).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));

    const mirrored = yield* register.mirrorLocalOutcome(identity, "Confirmed");
    if (mirrored.state !== "Confirmed") {
      // Local Closing stands; disclosure withheld until Confirmada (F05/F06).
      return yield* new Unavailable({ code: "UNAVAILABLE" });
    }
    const confirmed = yield* register.inspect(identity);
    if (confirmed.state !== "Confirmed") {
      return yield* new Unavailable({ code: "UNAVAILABLE" });
    }
    return disclosed(closed);
  }
);
