import { describe, expect, it } from "@effect/vitest";
import { Effect, Stream } from "effect";

import { collectExactBytes } from "../../../../src/adapters/object-storage/worlds/bytes.js";

describe("EX07 bounded byte collection", () => {
  it.effect(
    "stops before pulling more chunks once the declared bound is exceeded",
    () =>
      Effect.gen(function* boundBeforeMoreInput() {
        let extraPulls = 0;
        const content = Stream.concat(
          Stream.make(new Uint8Array(2)),
          Stream.fromEffect(
            Effect.sync(() => {
              extraPulls += 1;
              return new Uint8Array(1);
            })
          )
        );
        const failure = yield* collectExactBytes(
          content,
          1,
          "DigestMismatch"
        ).pipe(Effect.flip);
        expect(failure.reason).toBe("DigestMismatch");
        expect(extraPulls).toBe(0);
      })
  );

  it.effect(
    "copies each chunk before the source reuses its mutable buffer",
    () =>
      Effect.gen(function* reusedInputBuffer() {
        const chunk = new Uint8Array([1]);
        const content = Stream.concat(
          Stream.make(chunk),
          Stream.fromEffect(
            Effect.sync(() => {
              chunk[0] = 2;
              return chunk;
            })
          )
        );
        expect(
          yield* collectExactBytes(content, 2, "InvalidInput")
        ).toStrictEqual(new Uint8Array([1, 2]));
      })
  );
});
