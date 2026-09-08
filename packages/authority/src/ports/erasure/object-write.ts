import { Blocked, Unavailable } from "@zoen/contracts/worlds/errors";
import type { WorldRef } from "@zoen/contracts/worlds/values";
import { Context, Effect, Layer } from "effect";
import type { Effect as EffectType } from "effect";

/**
 * Settlement states for one admitted external object write (ZA-10).
 * HEAD 404 / client cancel never promote to terminal_observed.
 */
export type ObjectWriteAttemptState =
  | "registered"
  | "external_submitted"
  | "terminal_observed"
  | "unknown";

/**
 * G-STORAGE-FENCE: provider-level containment of submitted object I/O.
 * Object Lock / retention probes are not this gate. Absent proof → Blocked/Unknown.
 */
export type StorageFenceQualification = "Blocked" | "Unknown" | "Qualified";

/** Evidence that may settle or refuse to settle a write attempt. */
export type ObjectWriteSettlementEvidence =
  | {
      readonly _tag: "ProviderTerminal";
      readonly attemptId: string;
    }
  | {
      readonly _tag: "ClientCancelled";
      readonly attemptId: string;
    }
  | {
      readonly _tag: "HeadNotFound";
      readonly attemptId: string;
    }
  | {
      readonly _tag: "CredentialRetirement";
      readonly attemptId: string;
    }
  | {
      readonly _tag: "NetworkDisconnect";
      readonly attemptId: string;
    }
  | {
      readonly _tag: "TtlExpired";
      readonly attemptId: string;
    };

/**
 * External object-write admission/settlement boundary.
 * Durable registration precedes PutObject; Unknown blocks Erased.
 * Does not invent vendor containment APIs; G-STORAGE-FENCE stays honest.
 */
export class ErasureObjectWriteSettlement extends Context.Service<
  ErasureObjectWriteSettlement,
  {
    /**
     * Current G-STORAGE-FENCE status for this runtime/profile.
     * Never reports Qualified without an admitted provider fence proof.
     */
    readonly storageFenceQualification: EffectType.Effect<StorageFenceQualification>;
    /**
     * Refuse Erased while any attempt is registered (pre-send), submitted, or unknown.
     * Terminal-only Worlds may proceed to inventory/purge under local-controlled-copies.
     */
    readonly requireSettledWriters: (
      world: WorldRef
    ) => EffectType.Effect<void, Unavailable>;
    /**
     * Apply settlement evidence. HeadNotFound / cancel / TTL / network / retirement
     * without an admitted fence cannot clear submitted work (fail-closed).
     */
    readonly applySettlementEvidence: (
      evidence: ObjectWriteSettlementEvidence
    ) => EffectType.Effect<ObjectWriteAttemptState, Blocked | Unavailable>;
  }
>()("zoen/authority/ports/erasure/ObjectWriteSettlement") {
  /** Unqualified fence: settlement helpers still work via SQL; fence stays Blocked. */
  static readonly unqualifiedLayer = Layer.succeed(
    ErasureObjectWriteSettlement,
    ErasureObjectWriteSettlement.of({
      applySettlementEvidence: (evidence) => {
        if (evidence._tag === "ProviderTerminal") {
          return Effect.fail(new Unavailable({ code: "UNAVAILABLE" }));
        }
        return Effect.fail(new Blocked({ code: "PROFILE_BLOCKED" }));
      },
      requireSettledWriters: () =>
        Effect.fail(new Unavailable({ code: "UNAVAILABLE" })),
      storageFenceQualification: Effect.succeed("Blocked" as const),
    })
  );
}
