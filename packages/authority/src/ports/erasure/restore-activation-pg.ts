import { randomUUID } from "node:crypto";

import { Unavailable } from "@zoen/contracts/worlds/errors";
import { exact } from "@zoen/contracts/worlds/values";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import {
  allowsContentServingReadiness,
  currentRestoreActivationQualification,
  decideRestorePromotion,
  gatesAdmitRestorePromotion,
  linearizeErasureVersusActivation,
  phaseAllowsContentServing,
  phaseAllowsCredentialPromotion,
  raceBlocksRestorePromotion,
} from "./restore-activation-laws.js";
import type { RestoreAdmissionPhase } from "./restore-activation-laws.js";
import { ErasureRestoreActivation } from "./restore-activation.js";
import type { RestoreActivationState } from "./restore-activation.js";

const failUnavailable = () =>
  Effect.fail(new Unavailable({ code: "UNAVAILABLE" }));

const ActivationRow = Schema.Struct({
  backup_generation_id: Schema.NullOr(Schema.String.check(Schema.isUUID())),
  deployment_writer_id: Schema.String,
  phase: Schema.Literals([
    "Quarantined",
    "Preparing",
    "PromotionBlocked",
    "Active",
  ]),
  preparation_id: Schema.String.check(Schema.isUUID()),
}).annotate(exact);

const toState = (row: typeof ActivationRow.Type): RestoreActivationState => ({
  backupGenerationId: row.backup_generation_id,
  deploymentWriterId: row.deployment_writer_id,
  phase: row.phase,
  preparationId: row.preparation_id,
});

/**
 * Durable restore-activation adapter over erasure_attempt.restore_activation.
 * Empty table → NotRestored (ordinary installs). beginQuarantinedRestore persists
 * Quarantined state. Promotion remains fail-closed while H-01/G-OPS/G-STORAGE-FENCE
 * stay Blocked/Unknown — never advertises restoreAfterErasure:true.
 */
export const postgresRestoreActivationLayer: Layer.Layer<
  ErasureRestoreActivation,
  never,
  SqlClient.SqlClient
> = Layer.effect(
  ErasureRestoreActivation,
  Effect.gen(function* makePostgresRestoreActivation() {
    const sql = yield* SqlClient.SqlClient;
    const qualification = currentRestoreActivationQualification();

    const loadLatest = Effect.gen(function* load() {
      const rows = yield* sql`
        SELECT preparation_id::text, deployment_writer_id,
          backup_generation_id::text, phase
        FROM erasure_attempt.restore_activation
        ORDER BY updated_at DESC
        LIMIT 1
      `;
      if (rows.length === 0) {
        return { phase: "NotRestored" as const };
      }
      const row = yield* Schema.decodeUnknownEffect(ActivationRow)(rows[0]);
      return toState(row);
    }).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));

    const persist = (next: RestoreActivationState) =>
      sql`
        INSERT INTO erasure_attempt.restore_activation (
          preparation_id, deployment_writer_id, backup_generation_id, phase
        ) VALUES (
          ${next.preparationId}, ${next.deploymentWriterId},
          ${next.backupGenerationId}, ${next.phase}
        )
        ON CONFLICT (preparation_id) DO UPDATE SET
          deployment_writer_id = EXCLUDED.deployment_writer_id,
          backup_generation_id = EXCLUDED.backup_generation_id,
          phase = EXCLUDED.phase,
          updated_at = clock_timestamp()
      `.pipe(
        Effect.asVoid,
        Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
      );

    return ErasureRestoreActivation.of({
      beginQuarantinedRestore: (input) =>
        Effect.gen(function* begin() {
          // One active preparation per install: clear prior rows, mint fresh writer.
          yield* sql`DELETE FROM erasure_attempt.restore_activation`.pipe(
            Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
          );
          const next: RestoreActivationState = {
            backupGenerationId: input.backupGenerationId,
            deploymentWriterId: randomUUID(),
            phase: "Quarantined",
            preparationId: randomUUID(),
          };
          yield* persist(next);
          return next;
        }),
      enterPreparing: (preparationId) =>
        Effect.gen(function* prepare() {
          const current = yield* loadLatest;
          if (current.phase === "NotRestored") {
            return yield* failUnavailable();
          }
          if (current.preparationId !== preparationId) {
            return yield* failUnavailable();
          }
          if (
            current.phase !== "Quarantined" &&
            current.phase !== "Preparing"
          ) {
            return yield* failUnavailable();
          }
          const next: RestoreActivationState = {
            ...current,
            phase: "Preparing",
          };
          yield* persist(next);
          return next;
        }),
      observe: loadLatest,
      observeCurrentRights: () => Effect.succeed("unknown" as const),
      qualification: Effect.succeed(qualification),
      requireContentServing: Effect.gen(function* content() {
        const observation = yield* loadLatest;
        const rightsKnown = observation.phase === "NotRestored";
        const allowed = allowsContentServingReadiness({
          controllerFresh: true,
          phase: observation.phase,
          qualification,
          rightsKnown,
        });
        if (!allowed) {
          return yield* failUnavailable();
        }
        if (
          observation.phase !== "NotRestored" &&
          !phaseAllowsContentServing(observation.phase)
        ) {
          return yield* failUnavailable();
        }
        return yield* Effect.void;
      }),
      requireCredentialPromotion: Effect.gen(function* credentials() {
        const observation = yield* loadLatest;
        if (
          observation.phase === "NotRestored" ||
          !phaseAllowsCredentialPromotion(observation.phase) ||
          !gatesAdmitRestorePromotion(qualification)
        ) {
          return yield* failUnavailable();
        }
        return yield* Effect.void;
      }),
      requirePromotion: (preparationId, cut) =>
        Effect.gen(function* promote() {
          const current = yield* loadLatest;
          if (current.phase === "NotRestored") {
            return yield* failUnavailable();
          }
          if (current.preparationId !== preparationId) {
            return yield* failUnavailable();
          }
          const raceOrder = linearizeErasureVersusActivation(cut.erasureRace);
          if (raceBlocksRestorePromotion(raceOrder)) {
            const blocked: RestoreActivationState = {
              ...current,
              phase: "PromotionBlocked",
            };
            yield* persist(blocked);
            return yield* failUnavailable();
          }
          const decision = decideRestorePromotion({
            catalogCoverage: cut.catalogCoverage,
            controllerSuppression: cut.controllerSuppression,
            phase: current.phase,
            principalRights: cut.principalRights,
            qualification,
            writersSettled: cut.writersSettled,
          });
          if (!decision.admitted) {
            const blocked: RestoreActivationState = {
              ...current,
              phase:
                decision.phase === "Quarantined"
                  ? "Quarantined"
                  : "PromotionBlocked",
            };
            yield* persist(blocked);
            return yield* failUnavailable();
          }
          const active: RestoreActivationState = {
            ...current,
            phase: "Active" satisfies RestoreAdmissionPhase,
          };
          yield* persist(active);
          return active;
        }),
    });
  })
);
