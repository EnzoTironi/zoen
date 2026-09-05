import {
  D01_LIMITS,
  Digest,
  WorldRef,
  exact,
} from "@zoen/contracts/d01/values";
import type { Effect, Stream } from "effect";
import { Context, Schema } from "effect";

export const CaptureId = Schema.String.check(Schema.isUUID()).pipe(
  Schema.brand("zoen/CaptureId")
);
export type CaptureId = typeof CaptureId.Type;
export const ObjectLocation = Schema.Struct({
  byteLength: Schema.Int.check(
    Schema.isGreaterThan(0),
    Schema.isLessThanOrEqualTo(D01_LIMITS.documentBytes)
  ),
  captureId: CaptureId,
  digest: Digest,
  key: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(512)),
  versionId: Schema.NullOr(
    Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(512))
  ),
  worldRef: WorldRef,
}).annotate(exact);
export type ObjectLocation = typeof ObjectLocation.Type;
export class StorageFailure extends Schema.TaggedError<StorageFailure>()(
  "StorageFailure",
  {
    reason: Schema.Literals([
      "Unavailable",
      "InvalidInput",
      "DigestMismatch",
      "NotFound",
    ]),
  }
) {}
export class EvidenceObjectStore extends Context.Service<
  EvidenceObjectStore,
  {
    readonly stage: (input: {
      readonly worldRef: WorldRef;
      readonly captureId: CaptureId;
      readonly content: Stream.Stream<Uint8Array, StorageFailure>;
      readonly expectedDigest: typeof Digest.Type;
      readonly expectedBytes: number;
    }) => Effect.Effect<ObjectLocation, StorageFailure>;
    readonly locate: (input: {
      readonly worldRef: WorldRef;
      readonly captureId: CaptureId;
      readonly expectedDigest: typeof Digest.Type;
      readonly expectedBytes: number;
    }) => Effect.Effect<ObjectLocation, StorageFailure>;
    readonly read: (
      location: ObjectLocation
    ) => Effect.Effect<Uint8Array, StorageFailure>;
    readonly remove: (
      location: ObjectLocation
    ) => Effect.Effect<void, StorageFailure>;
  }
>()("zoen/authority/ports/d01/EvidenceObjectStore") {}
