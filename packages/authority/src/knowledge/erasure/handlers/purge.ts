import { WorldContentPurged } from "@zoen/contracts/erasure/operations";
import type { PurgeWorldContent } from "@zoen/contracts/erasure/operations";
import { WorldErasurePhase } from "@zoen/contracts/erasure/values";
import { Conflict, Stale, Unavailable } from "@zoen/contracts/worlds/errors";
import { Revision, exact } from "@zoen/contracts/worlds/values";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { authorizeWorld } from "../../../access/world.js";
import { AuthorityInstallation } from "../../../commit/configuration.js";
import { bindWorldIntent } from "../../../commit/intent.js";
import {
  commitMutation,
  readMutationReplay,
} from "../../../commit/mutation.js";
import { ErasureAttemptRegister } from "../../../ports/erasure/attempt-register.js";
import { ErasureCopyCatalog } from "../../../ports/erasure/copy-catalog.js";
import { ErasureObjectInventory } from "../../../ports/erasure/inventory.js";
import { ErasurePurgeStore } from "../../../ports/erasure/purge.js";
import type { VerifiedRequestContext } from "../../../ports/worlds/context.js";
import { requireHostedErasablePurgeAdmission } from "../hosted-erasable-gate.js";
import { requireErasablePolicy } from "../policy.js";
import {
  lockPurgingProgress,
  requireEmptyObjectSurface,
  requireSettledExternalWriters,
} from "../purge-guard.js";
import { completePurgeOutcomes } from "../purge-outcomes.js";
import { purgeWorldSqlContent } from "../sql-purge.js";

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

/**
 * Closing → Purging → Erased for local controlled SQL + object versions.
 * Closing receipt stays immutable; Inspect reports current phase.
 * restoreAfterErasure remains false (F04).
 */
export const purgeWorldContent = Effect.fn("erasure.purgeWorldContent")(
  function* purgeWorldContent(
    context: VerifiedRequestContext,
    request: typeof PurgeWorldContent.Type
  ) {
    yield* authorizeWorld(context, request.worldRef, "erasure");
    const installation = yield* AuthorityInstallation;
    const register = yield* ErasureAttemptRegister;
    const inventory = yield* ErasureObjectInventory;
    const purgeStore = yield* ErasurePurgeStore;
    const copyCatalog = yield* ErasureCopyCatalog;
    const sql = yield* SqlClient.SqlClient;
    const world = request.worldRef;

    const [progress] = yield* sql`
      SELECT phase, erasure_revision::text, closing_operation_id,
        closing_receipt_id, policy_version
      FROM authority.world_erasure_progress
      WHERE world_id = ${world.worldId} AND realm = ${world.realm}
    `;
    if (progress === undefined) {
      return yield* new Conflict({ code: "CONFLICT" });
    }
    const current = yield* Schema.decodeUnknownEffect(ProgressRow)(
      progress
    ).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));

    if (
      current.closing_operation_id !== request.input.closingOperationId ||
      current.closing_receipt_id === null ||
      current.policy_version === null
    ) {
      return yield* new Conflict({ code: "CONFLICT" });
    }
    const closingReceiptId = current.closing_receipt_id;
    const policyVersion = current.policy_version;
    if (
      current.phase !== "Closing" &&
      current.phase !== "Suppressed" &&
      current.phase !== "Purging" &&
      current.phase !== "Erased" &&
      current.phase !== "Blocked"
    ) {
      return yield* new Conflict({ code: "CONFLICT" });
    }

    const erasablePolicy = yield* requireErasablePolicy(current.policy_version);
    yield* requireHostedErasablePurgeAdmission({
      policy: erasablePolicy,
    });

    const observed = yield* register.inspect({
      deploymentEpoch: deploymentEpochOf(installation),
      operationId: request.input.closingOperationId,
      principalId: context.presence.principalId,
      worldRef: world,
    });
    if (observed.state !== "Confirmed") {
      return yield* new Unavailable({ code: "UNAVAILABLE" });
    }

    const bound = yield* bindWorldIntent(request);
    const replay = yield* readMutationReplay(context, bound);
    if (replay !== null) {
      return yield* Schema.decodeUnknownEffect(WorldContentPurged)(replay).pipe(
        Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
      );
    }

    if (current.phase === "Erased" || current.phase === "Blocked") {
      // Terminal without matching purge receipt → conflict (do not invent success).
      return yield* new Conflict({ code: "CONFLICT" });
    }
    // Revision gate only for new purge work (replay already handled).
    if (current.erasure_revision !== request.input.expectedErasureRevision) {
      return yield* new Stale({ code: "STALE" });
    }

    yield* requireSettledExternalWriters(world);

    if (current.phase === "Closing" || current.phase === "Suppressed") {
      yield* sql`
        UPDATE authority.world_erasure_progress
        SET phase = ${"Purging"}, updated_at = clock_timestamp()
        WHERE world_id = ${world.worldId} AND realm = ${world.realm}
          AND (phase = ${"Closing"} OR phase = ${"Suppressed"})
      `;
    }

    // External S3 I/O outside the semantic mutation transaction.
    const manifest = yield* inventory.listWorldVersions(world);
    const outcomes = yield* purgeStore.purgeManifest(manifest.entries);
    if (!completePurgeOutcomes(manifest.entries, outcomes)) {
      return yield* new Unavailable({ code: "UNAVAILABLE" });
    }
    const progressIdentity = {
      closingOperationId: request.input.closingOperationId,
      closingReceiptId,
      policyVersion,
      revision: current.erasure_revision,
      world,
    };
    const blocked = outcomes.some(
      (row) => row.outcome === "Blocked" || row.outcome === "Unknown"
    );
    const removed = outcomes.filter(
      (row) => row.outcome === "Removed" || row.outcome === "AlreadyAbsent"
    ).length;

    if (blocked) {
      const result = yield* commitMutation(context, bound, {
        apply: (receiptRef) =>
          Effect.gen(function* applyBlocked() {
            yield* lockPurgingProgress(progressIdentity);
            yield* sql`
              UPDATE authority.world_erasure_progress
              SET phase = ${"Blocked"}, updated_at = clock_timestamp()
              WHERE world_id = ${world.worldId} AND realm = ${world.realm}
            `;
            const stored = yield* Schema.decodeEffect(WorldContentPurged)({
              _tag: "WorldContentPurged",
              attemptExternalState: "Confirmed",
              attestationScope: "local-controlled-copies",
              objectVersionsRemoved: removed,
              phase: "Blocked",
              policyVersion,
              receiptRef,
              restoreAfterErasure: false,
              revision: current.erasure_revision,
              sqlContentPurged: false,
              worldRef: world,
            }).pipe(
              Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
            );
            return { changedDomains: [], result: stored };
          }),
        basis: null,
        domains: ["membership"],
      });
      return yield* Schema.decodeUnknownEffect(WorldContentPurged)(result).pipe(
        Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
      );
    }

    yield* requireEmptyObjectSurface(world);

    const result = yield* commitMutation(context, bound, {
      apply: (receiptRef) =>
        Effect.gen(function* applyErased() {
          yield* sql`
            SELECT world_id FROM authority.worlds
            WHERE world_id = ${world.worldId} AND realm = ${world.realm}
            FOR UPDATE
          `;
          yield* lockPurgingProgress(progressIdentity);
          // ZA-12: Full Erased requires current BoundedComplete catalog admission.
          yield* copyCatalog.requireAdmission(
            erasablePolicy.profileId,
            "full-erased"
          );
          yield* purgeWorldSqlContent({
            closingReceiptId,
            purgeReceiptId: receiptRef,
            worldRef: world,
          });
          const nextRevision = yield* Schema.decodeEffect(Revision)(
            (BigInt(current.erasure_revision) + 1n).toString()
          ).pipe(
            Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
          );
          const erased = yield* sql`
            UPDATE authority.world_erasure_progress
            SET phase = ${"Erased"},
                erasure_revision = ${nextRevision},
                updated_at = clock_timestamp()
            WHERE world_id = ${world.worldId} AND realm = ${world.realm}
              AND phase = ${"Purging"}
            RETURNING world_id
          `;
          if (erased.length !== 1) {
            return yield* new Conflict({ code: "CONFLICT" });
          }
          const stored = yield* Schema.decodeEffect(WorldContentPurged)({
            _tag: "WorldContentPurged",
            attemptExternalState: "Confirmed",
            attestationScope: "local-controlled-copies",
            objectVersionsRemoved: removed,
            phase: "Erased",
            policyVersion,
            receiptRef,
            restoreAfterErasure: false,
            revision: nextRevision,
            sqlContentPurged: true,
            worldRef: world,
          }).pipe(
            Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
          );
          return {
            changedDomains: [
              "membership",
              "sources",
              "evidence",
              "claims",
              "cases",
            ] as const,
            result: stored,
          };
        }),
      basis: null,
      domains: ["membership", "sources", "evidence", "claims", "cases"],
    });

    return yield* Schema.decodeUnknownEffect(WorldContentPurged)(result).pipe(
      Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
    );
  }
);
