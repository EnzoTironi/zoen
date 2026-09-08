import { Unavailable } from "@zoen/contracts/worlds/errors";
import { Context, Effect, Layer } from "effect";
import type { Effect as EffectType } from "effect";

/**
 * External monotone freshness witness for the independent controller (ZA-11).
 * Must not share the controller store's rollback unit. A valid signed controller
 * head alone does not prove freshness — the admitted anchor sequence must match.
 */
export interface ErasureAnchorObservation {
  readonly admittedSequence: bigint;
}

const failUnavailable = () =>
  Effect.fail(new Unavailable({ code: "UNAVAILABLE" }));

export class ErasureExternalAnchor extends Context.Service<
  ErasureExternalAnchor,
  {
    /** Current admitted monotone sequence (never decreases). */
    readonly inspect: EffectType.Effect<ErasureAnchorObservation, Unavailable>;
    /**
     * Advance the admitted sequence to at least `sequence`. Refuses to move
     * backward; equal is a no-op replay.
     */
    readonly advance: (
      sequence: bigint
    ) => EffectType.Effect<ErasureAnchorObservation, Unavailable>;
  }
>()("zoen/authority/ports/erasure/ExternalAnchor") {
  /**
   * Unqualified / absent anchor: every freshness check fails closed.
   * Do not pretend a memory counter is an independent witness.
   */
  static readonly unqualifiedLayer = Layer.succeed(
    ErasureExternalAnchor,
    ErasureExternalAnchor.of({
      advance: () => failUnavailable(),
      inspect: failUnavailable(),
    })
  );
}
