import { randomUUID } from "node:crypto";

import { Unavailable } from "@zoen/contracts/worlds/errors";
import type { WorldRef } from "@zoen/contracts/worlds/values";
import { Context, Effect, Layer } from "effect";
import type { Effect as EffectType } from "effect";

import type { ErasureWorldSuppressionObservation } from "./attempt-register.js";
import type { ControlledCopyCoverageStatus } from "./copy-catalog.js";
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
import type {
  ErasureActivationRace,
  RestoreAdmissionPhase,
  RestoreActivationQualification,
  RestoredPrincipalRights,
} from "./restore-activation-laws.js";

/**
 * ZA-13 restore activation port.
 *
 * Restored installs mint a non-reused writer identity and stay Quarantined until
 * a single admitted promotion protocol succeeds. Unqualified layers never
 * promote: H-01 / G-OPS / G-STORAGE-FENCE stay Blocked/Unknown and
 * restoreAfterErasure remains false.
 */

export interface RestoreActivationState {
  readonly backupGenerationId: string | null;
  readonly deploymentWriterId: string;
  readonly phase: RestoreAdmissionPhase;
  readonly preparationId: string;
}

export type RestoreActivationObservation =
  | RestoreActivationState
  | { readonly phase: "NotRestored" };

export interface RestorePromotionCut {
  readonly catalogCoverage: ControlledCopyCoverageStatus;
  readonly controllerSuppression: ErasureWorldSuppressionObservation;
  /** Caller-supplied durable race posture — linearized before promotion. */
  readonly erasureRace: ErasureActivationRace;
  readonly principalRights: RestoredPrincipalRights;
  readonly writersSettled: boolean;
}

const failUnavailable = () =>
  Effect.fail(new Unavailable({ code: "UNAVAILABLE" }));

export class ErasureRestoreActivation extends Context.Service<
  ErasureRestoreActivation,
  {
    /** Honest gate surface — never reports Qualified without human/ops proof. */
    readonly qualification: EffectType.Effect<RestoreActivationQualification>;
    /** Observe current restore admission state for this process/install. */
    readonly observe: EffectType.Effect<
      RestoreActivationObservation,
      Unavailable
    >;
    /**
     * Start a restored install closed with a fresh deployment/writer identity.
     * Does not revive backup credentials or sessions.
     */
    readonly beginQuarantinedRestore: (input: {
      readonly backupGenerationId: string | null;
    }) => EffectType.Effect<RestoreActivationState, Unavailable>;
    /**
     * Move Quarantined → Preparing after fencing previous writers. Still does
     * not serve content.
     */
    readonly enterPreparing: (
      preparationId: string
    ) => EffectType.Effect<RestoreActivationState, Unavailable>;
    /**
     * Attempt promotion under the admitted protocol. Fail-closed while gates,
     * suppression, rights, catalog, or writers block.
     */
    readonly requirePromotion: (
      preparationId: string,
      cut: RestorePromotionCut
    ) => EffectType.Effect<RestoreActivationState, Unavailable>;
    /**
     * Content-serving readiness / HTTP admission. Closed for Quarantined and
     * whenever controller/rights are unknown.
     */
    readonly requireContentServing: EffectType.Effect<void, Unavailable>;
    /**
     * Credential / session promotion from a restored backup. Always refused
     * until Active under qualified gates.
     */
    readonly requireCredentialPromotion: EffectType.Effect<void, Unavailable>;
    /**
     * Current rights for a principal/World — independent of restored membership
     * rows and of identity login alone.
     */
    readonly observeCurrentRights: (
      world: WorldRef,
      principalId: string
    ) => EffectType.Effect<RestoredPrincipalRights, Unavailable>;
  }
>()("zoen/authority/ports/erasure/RestoreActivation") {
  /**
   * Default composition: not a restore, but qualification stays honest and
   * credential promotion from backups remains unavailable. Content serving for
   * ordinary (non-restore) installs is not gated here.
   */
  static readonly unqualifiedLayer = Layer.succeed(
    ErasureRestoreActivation,
    ErasureRestoreActivation.of({
      beginQuarantinedRestore: () => failUnavailable(),
      enterPreparing: () => failUnavailable(),
      observe: Effect.succeed({ phase: "NotRestored" as const }),
      observeCurrentRights: () => Effect.succeed("unknown" as const),
      qualification: Effect.succeed(currentRestoreActivationQualification()),
      requireContentServing: Effect.void,
      requireCredentialPromotion: failUnavailable(),
      requirePromotion: () => failUnavailable(),
    })
  );
}

/**
 * In-memory restore activation for disposable proofs. Still uses honest
 * qualification — promotion cannot succeed until gates clear.
 */
export const memoryRestoreActivationLayer = (options?: {
  readonly initial?: RestoreActivationObservation;
  readonly rights?: ReadonlyMap<string, RestoredPrincipalRights>;
}): Layer.Layer<ErasureRestoreActivation> => {
  const state: { current: RestoreActivationObservation } = {
    current: options?.initial ?? { phase: "NotRestored" },
  };
  const rights = options?.rights ?? new Map<string, RestoredPrincipalRights>();
  const qualification = currentRestoreActivationQualification();

  const readState = (): RestoreActivationState => {
    if (state.current.phase === "NotRestored") {
      throw new Error("restore activation not started");
    }
    return state.current;
  };

  return Layer.succeed(
    ErasureRestoreActivation,
    ErasureRestoreActivation.of({
      beginQuarantinedRestore: (input) =>
        Effect.sync(() => {
          const next: RestoreActivationState = {
            backupGenerationId: input.backupGenerationId,
            deploymentWriterId: randomUUID(),
            phase: "Quarantined",
            preparationId: randomUUID(),
          };
          state.current = next;
          return next;
        }),
      enterPreparing: (preparationId) =>
        Effect.gen(function* prepare() {
          if (state.current.phase === "NotRestored") {
            return yield* failUnavailable();
          }
          if (state.current.preparationId !== preparationId) {
            return yield* failUnavailable();
          }
          if (
            state.current.phase !== "Quarantined" &&
            state.current.phase !== "Preparing"
          ) {
            return yield* failUnavailable();
          }
          const next: RestoreActivationState = {
            ...state.current,
            phase: "Preparing",
          };
          state.current = next;
          return next;
        }),
      observe: Effect.sync(() => state.current),
      observeCurrentRights: (world, principalId) =>
        Effect.succeed(
          rights.get(`${world.realm}:${world.worldId}:${principalId}`) ??
            "unknown"
        ),
      qualification: Effect.succeed(qualification),
      requireContentServing: Effect.gen(function* content() {
        const observation = state.current;
        const rightsKnown =
          observation.phase === "NotRestored"
            ? true
            : [...rights.values()].every((value) => value !== "unknown");
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
        const observation = state.current;
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
          if (state.current.phase === "NotRestored") {
            return yield* failUnavailable();
          }
          if (state.current.preparationId !== preparationId) {
            return yield* failUnavailable();
          }
          const raceOrder = linearizeErasureVersusActivation(cut.erasureRace);
          if (raceBlocksRestorePromotion(raceOrder)) {
            const blocked: RestoreActivationState = {
              ...state.current,
              phase: "PromotionBlocked",
            };
            state.current = blocked;
            return yield* failUnavailable();
          }
          const decision = decideRestorePromotion({
            catalogCoverage: cut.catalogCoverage,
            controllerSuppression: cut.controllerSuppression,
            phase: state.current.phase,
            principalRights: cut.principalRights,
            qualification,
            writersSettled: cut.writersSettled,
          });
          if (!decision.admitted) {
            const blocked: RestoreActivationState = {
              ...state.current,
              phase:
                decision.phase === "Quarantined"
                  ? "Quarantined"
                  : "PromotionBlocked",
            };
            state.current = blocked;
            return yield* failUnavailable();
          }
          const active: RestoreActivationState = {
            ...readState(),
            phase: "Active",
          };
          state.current = active;
          return active;
        }),
    })
  );
};

export {
  allowsContentServingReadiness,
  currentRestoreActivationQualification,
  decideRestorePromotion,
  gatesAdmitRestorePromotion,
  linearizeErasureVersusActivation,
  phaseAllowsContentServing,
  phaseAllowsCredentialPromotion,
  raceBlocksRestorePromotion,
} from "./restore-activation-laws.js";
export type {
  ErasureActivationOrder,
  ErasureActivationRace,
  PromotionDecision,
  PromotionPreconditions,
  RestoreAdmissionPhase,
  RestoreActivationQualification,
  RestoreGateStatus,
  RestoredPrincipalRights,
} from "./restore-activation-laws.js";
