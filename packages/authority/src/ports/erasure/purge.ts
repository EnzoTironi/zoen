import type {
  ErasureObjectHoldState,
  ErasureObjectVersionId,
  ErasureVersionEntry,
  ErasureVersionPurgeOutcome,
} from "@zoen/contracts/erasure/values";
import { Unavailable } from "@zoen/contracts/worlds/errors";
import { Context, Effect, Layer } from "effect";
import type { Effect as EffectType } from "effect";

export interface ErasureVersionTarget {
  readonly key: string;
  readonly versionId: ErasureObjectVersionId;
  readonly deleteMarker: boolean;
}

/**
 * Purge port for explicit version deletes (freeze F08 / ER-R05).
 * MUST NOT reuse EvidenceObjectStore.remove (which collapses versionId "null").
 * Product path never sets BypassGovernanceRetention — holds → Blocked.
 */
export class ErasurePurgeStore extends Context.Service<
  ErasurePurgeStore,
  {
    /** Inspect retention / legal hold for one version. Unknown → fail closed. */
    readonly inspectHold: (
      target: ErasureVersionTarget
    ) => EffectType.Effect<ErasureObjectHoldState, Unavailable>;
    /**
     * Delete exactly one version or delete marker by VersionId.
     * VersionId is always required (including literal "null").
     * Hold/retention → Blocked outcome (not Unavailable), without elevating grants.
     */
    readonly purgeVersion: (
      target: ErasureVersionTarget
    ) => EffectType.Effect<ErasureVersionPurgeOutcome, Unavailable>;
    /**
     * Purge every entry in a manifest after hold checks.
     * Stops elevating nothing: each entry is independent; Blocked entries are reported.
     */
    readonly purgeManifest: (
      entries: readonly ErasureVersionEntry[]
    ) => EffectType.Effect<
      readonly {
        readonly entry: ErasureVersionEntry;
        readonly outcome: ErasureVersionPurgeOutcome;
      }[],
      Unavailable
    >;
  }
>()("zoen/authority/ports/erasure/PurgeStore") {
  static readonly unqualifiedLayer = Layer.succeed(
    ErasurePurgeStore,
    ErasurePurgeStore.of({
      inspectHold: () => Effect.fail(new Unavailable({ code: "UNAVAILABLE" })),
      purgeManifest: () =>
        Effect.fail(new Unavailable({ code: "UNAVAILABLE" })),
      purgeVersion: () => Effect.fail(new Unavailable({ code: "UNAVAILABLE" })),
    })
  );
}
