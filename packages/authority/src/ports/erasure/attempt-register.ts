import type { ErasureAttemptExternalState } from "@zoen/contracts/erasure/values";
import { Unavailable } from "@zoen/contracts/worlds/errors";
import type { Conflict } from "@zoen/contracts/worlds/errors";
import type {
  OperationId,
  Revision,
  WorldRef,
} from "@zoen/contracts/worlds/values";
import { Context, Effect, Layer } from "effect";
import type { Effect as EffectType } from "effect";

import type { PrincipalId } from "../worlds/context.js";

/**
 * External attempt register (ER-R01 / freeze F01).
 * Records attempt *existence* outside application rollback before local Closing.
 * Pending registration is not suppression, consent, grant, or purge authorization.
 *
 * Local PG adapter under `local-pg.ts` is qualified-enough for disposable compose
 * proofs only. A real controller (distinct topology, grants, epochs, independent
 * anti-rollback anchor) remains blocked for production Closing/purge.
 *
 * ZA-11 local narrow profile: separately scoped controller store + external
 * monotone anchor. Hosted/full independence stays fail-closed (H-01 / G-OPS).
 */
export interface ErasureAttemptIdentity {
  readonly deploymentEpoch: string;
  readonly operationId: typeof OperationId.Type;
  readonly principalId: typeof PrincipalId.Type;
  readonly worldRef: WorldRef;
}

/** Intention fields bound into the register digest (payload conflict surface). */
export interface ErasureAttemptIntention {
  readonly confirmEntireWorld: true;
  readonly expectedErasureRevision: typeof Revision.Type | null;
  readonly policyVersion: string;
}

export interface ErasureAttemptObservation {
  readonly state: ErasureAttemptExternalState;
}

/**
 * World-level controller observation for content admission (ZA-11).
 * `Clear` means the controller knows no blocking attempt for the World.
 */
export type ErasureWorldSuppressionObservation =
  | ErasureAttemptObservation
  | { readonly state: "Clear" };

/** Registered / Unknown block restore activation; Confirmed/Aborted are terminals. */
export const blocksWorldActivation = (
  state: ErasureAttemptExternalState
): boolean => state === "Registered" || state === "Unknown";

/** States that keep content admission closed until reconciliation (ZA-11-01). */
export const blocksWorldContentAdmission = (
  observation: ErasureWorldSuppressionObservation
): boolean =>
  observation.state === "Registered" ||
  observation.state === "Confirmed" ||
  observation.state === "Unknown";

const failUnavailable = () =>
  Effect.fail(new Unavailable({ code: "UNAVAILABLE" }));

export class ErasureAttemptRegister extends Context.Service<
  ErasureAttemptRegister,
  {
    /** Register attempt existence; same identity+payload replays; different payload Conflicts. */
    readonly register: (
      identity: ErasureAttemptIdentity,
      intention: ErasureAttemptIntention
    ) => EffectType.Effect<ErasureAttemptObservation, Conflict | Unavailable>;
    /** Observe terminal or Unknown state for the same identity. */
    readonly inspect: (
      identity: ErasureAttemptIdentity
    ) => EffectType.Effect<ErasureAttemptObservation, Conflict | Unavailable>;
    /**
     * Mirror a local definitive outcome (Confirmed after Closing, or Aborted
     * only with proved non-erasure local outcome). Never invent Aborted from timeout.
     */
    readonly mirrorLocalOutcome: (
      identity: ErasureAttemptIdentity,
      outcome: "Confirmed" | "Aborted"
    ) => EffectType.Effect<ErasureAttemptObservation, Conflict | Unavailable>;
    /**
     * Observe whether any attempt for the World still blocks content admission.
     * Prefer Confirmed over Registered over Unknown when multiple rows exist.
     * Unqualified controllers report Clear (no independent knowledge) — local
     * progress fence remains authoritative for those installs.
     */
    readonly observeWorld: (
      worldRef: WorldRef
    ) => EffectType.Effect<ErasureWorldSuppressionObservation, Unavailable>;
  }
>()("zoen/authority/ports/erasure/AttemptRegister") {
  /**
   * Unqualified controller oracle: never fabricates Confirmed/Aborted.
   * observeWorld returns Clear so retained/non-controller paths keep working.
   * Retained until a topology-qualified adapter is admitted.
   */
  static readonly unqualifiedLayer = Layer.succeed(
    ErasureAttemptRegister,
    ErasureAttemptRegister.of({
      inspect: () => failUnavailable(),
      mirrorLocalOutcome: () => failUnavailable(),
      observeWorld: () => Effect.succeed({ state: "Clear" as const }),
      register: () => failUnavailable(),
    })
  );
}
