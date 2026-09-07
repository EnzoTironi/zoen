import { Unavailable } from "@zoen/contracts/d01/errors";
import type { WorldRef } from "@zoen/contracts/d01/values";
import type { ErasureVersionManifest } from "@zoen/contracts/erasure/values";
import { Context, Effect, Layer } from "effect";
import type { Effect as EffectType } from "effect";

/**
 * World-scoped object version inventory for erasure purge (ListObjectVersions).
 * Server derives the canonical prefix from WorldRef — never accepts client prefixes.
 * Distinct from EvidenceObjectStore; does not stage or read content.
 */
export class ErasureObjectInventory extends Context.Service<
  ErasureObjectInventory,
  {
    /**
     * Full paginated inventory of versions and delete markers under the World
     * namespace. Cursors are opaque; literal versionId "null" is preserved.
     */
    readonly listWorldVersions: (
      worldRef: WorldRef
    ) => EffectType.Effect<ErasureVersionManifest, Unavailable>;
  }
>()("zoen/authority/ports/erasure/ObjectInventory") {
  /** Unqualified until a storage adapter is provided. */
  static readonly unqualifiedLayer = Layer.succeed(
    ErasureObjectInventory,
    ErasureObjectInventory.of({
      listWorldVersions: () =>
        Effect.fail(new Unavailable({ code: "UNAVAILABLE" })),
    })
  );
}
