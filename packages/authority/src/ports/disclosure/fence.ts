import type {
  Blocked,
  Expired,
  Unavailable,
} from "@zoen/contracts/worlds/errors";
import type { Instant, WorldRef } from "@zoen/contracts/worlds/values";
import { Context } from "effect";
import type { Effect, Scope } from "effect";

import type { VerifiedPresence } from "../worlds/context.js";

/** Only a trusted emitter may acknowledge completion or prove it cannot begin. */
export interface DisclosurePermit {
  readonly acknowledge: Effect.Effect<void, Unavailable>;
  /** Inventory identity for this writer attempt; retirement blocks new send. */
  readonly writerEpoch: string;
  readonly permitId: string;
  /**
   * Synchronous send linearization gate. Must run immediately before `end`.
   * `"retired"` means this epoch was contained and may not emit new private bytes.
   */
  readonly authorizeSend: () => "authorized" | "retired";
}

/**
 * Independent containment evidence for this runtime.
 * Network disconnect / TTL alone are not accepted (see `RejectedContainment`).
 */
export type WriterContainment =
  | {
      readonly _tag: "SupervisorProcessExit";
      readonly permitId: string;
      readonly writerEpoch: string;
      readonly pid: number;
      readonly exitStatus: number;
    }
  | {
      readonly _tag: "NetworkDisconnect";
      readonly permitId: string;
      readonly writerEpoch: string;
    }
  | {
      readonly _tag: "TtlExpired";
      readonly permitId: string;
      readonly writerEpoch: string;
    };

/** Physical coordination only; authorization remains in the semantic executor. */
export class DisclosureFence extends Context.Service<
  DisclosureFence,
  {
    readonly shared: (
      presence: VerifiedPresence,
      world: WorldRef,
      deadline: typeof Instant.Type
    ) => Effect.Effect<DisclosurePermit, Expired | Unavailable, Scope.Scope>;
    readonly exclusiveSession: (
      presence: VerifiedPresence,
      deadline: typeof Instant.Type
    ) => Effect.Effect<void, Expired | Unavailable, Scope.Scope>;
    /**
     * Retire one writer epoch only after independent containment, then advance
     * pending under the same disclosure protocol. Does not claim network retraction.
     */
    readonly recoverOrphaned: (
      containment: WriterContainment,
      deadline: typeof Instant.Type
    ) => Effect.Effect<void, Blocked | Expired | Unavailable, Scope.Scope>;
    readonly checkHealth: Effect.Effect<void, Unavailable>;
  }
>()("zoen/authority/ports/disclosure/Fence") {}
