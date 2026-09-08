import type { ErasureVersionManifest } from "@zoen/contracts/erasure/values";
import { Unavailable } from "@zoen/contracts/worlds/errors";
import type { WorldRef } from "@zoen/contracts/worlds/values";
import { Context, Effect, Layer } from "effect";
import type { Effect as EffectType } from "effect";

/** One in-progress multipart upload under a World prefix (opaque UploadId). */
export interface ErasureMultipartUpload {
  readonly key: string;
  readonly uploadId: string;
}

export interface ErasureMultipartManifest {
  readonly prefix: string;
  readonly uploads: readonly ErasureMultipartUpload[];
}

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
    /**
     * Paginated ListMultipartUploads under the World prefix.
     * Non-empty or Unknown listing blocks Erased (ZA-10-04); no elevated abort grants.
     */
    readonly listWorldMultipartUploads: (
      worldRef: WorldRef
    ) => EffectType.Effect<ErasureMultipartManifest, Unavailable>;
  }
>()("zoen/ontology/ports/erasure/ObjectInventory") {
  /** Unqualified until a storage adapter is provided. */
  static readonly unqualifiedLayer = Layer.succeed(
    ErasureObjectInventory,
    ErasureObjectInventory.of({
      listWorldMultipartUploads: () =>
        Effect.fail(new Unavailable({ code: "UNAVAILABLE" })),
      listWorldVersions: () =>
        Effect.fail(new Unavailable({ code: "UNAVAILABLE" })),
    })
  );
}
