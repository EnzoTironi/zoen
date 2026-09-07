import { StorageFailure } from "@zoen/authority/ports/worlds/storage";
import { D01_LIMITS } from "@zoen/contracts/worlds/values";
import { Effect, Stream } from "effect";

/** A single bounded allocation; each chunk is copied before upstream can reuse it. */
export const collectExactBytes = (
  content: Stream.Stream<Uint8Array, StorageFailure>,
  expectedBytes: number,
  mismatch: "InvalidInput" | "DigestMismatch"
) =>
  Effect.gen(function* collectBoundedBytes() {
    if (
      !Number.isSafeInteger(expectedBytes) ||
      expectedBytes < 1 ||
      expectedBytes > D01_LIMITS.documentBytes
    ) {
      return yield* new StorageFailure({ reason: mismatch });
    }
    const output = new Uint8Array(expectedBytes);
    let offset = 0;
    yield* Stream.runForEach(content, (chunk) =>
      Effect.suspend(() => {
        if (chunk.byteLength > expectedBytes - offset) {
          return Effect.fail(new StorageFailure({ reason: mismatch }));
        }
        output.set(chunk, offset);
        offset += chunk.byteLength;
        return Effect.void;
      })
    );
    if (offset !== expectedBytes) {
      return yield* new StorageFailure({ reason: mismatch });
    }
    return output;
  });
