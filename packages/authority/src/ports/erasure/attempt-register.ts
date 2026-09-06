import type { Unavailable } from "@zoen/contracts/d01/errors";
import type { OperationId, WorldRef } from "@zoen/contracts/d01/values";
import type { ErasureAttemptExternalState } from "@zoen/contracts/erasure/values";
import { Context } from "effect";
import type { Effect } from "effect";

import type { PrincipalId } from "../d01/context.js";

/**
 * External attempt register (ER-R01 / freeze F01).
 * Records attempt *existence* outside application rollback before local Closing.
 * Pending registration is not suppression, consent, grant, or purge authorization.
 *
 * A real controller adapter is **blocked** until topology, distinct grants,
 * epochs, and an independent anti-rollback anchor are qualified.
 */
export interface ErasureAttemptIdentity {
  readonly deploymentEpoch: string;
  readonly operationId: typeof OperationId.Type;
  readonly principalId: typeof PrincipalId.Type;
  readonly worldRef: typeof WorldRef.Type;
}

export class ErasureAttemptRegister extends Context.Service<
  ErasureAttemptRegister,
  {
    /** Register attempt existence; Unknown on ambiguous I/O — same identity retry. */
    readonly register: (
      identity: ErasureAttemptIdentity
    ) => Effect.Effect<
      { readonly state: typeof ErasureAttemptExternalState.Type },
      Unavailable
    >;
    /** Observe terminal or Unknown state for the same identity. */
    readonly inspect: (
      identity: ErasureAttemptIdentity
    ) => Effect.Effect<
      { readonly state: typeof ErasureAttemptExternalState.Type },
      Unavailable
    >;
    /**
     * Mirror a local definitive outcome (Confirmed after Closing, or Aborted
     * only with proved non-erasure local outcome). Never invent Aborted from timeout.
     */
    readonly mirrorLocalOutcome: (
      identity: ErasureAttemptIdentity,
      outcome: "Confirmed" | "Aborted"
    ) => Effect.Effect<
      { readonly state: typeof ErasureAttemptExternalState.Type },
      Unavailable
    >;
  }
>()("zoen/authority/ports/erasure/AttemptRegister") {}
