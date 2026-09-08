import { expect, it } from "@effect/vitest";
import { EvidenceObjectStore } from "@zoen/ontology/ports/worlds/storage";
import { digestBytes } from "@zoen/ontology/values/canonical";
import { Effect, Result, Stream } from "effect";

import { layer } from "../../../../src/adapters/object-storage/worlds/s3.ts";
import { withStorage, stageInput, reservation } from "./fixture.ts";

it.live(
  "independent concurrent conflicting PUTs preserve exactly one original payload",
  () =>
    withStorage(() =>
      Effect.gen(function* concurrentDifferentBytes() {
        const store = yield* EvidenceObjectStore;
        const a = new TextEncoder().encode('{"original":"a"}');
        const b = new TextEncoder().encode('{"original":"b"}');
        const input = stageInput(a);
        const alternate = {
          ...input,
          content: Stream.make(b),
          expectedBytes: b.length,
          expectedDigest: digestBytes(b),
        };
        const results = yield* Effect.all(
          [
            store.stage(input).pipe(Effect.result),
            store.stage(alternate).pipe(Effect.result),
          ],
          { concurrency: 2 }
        );
        const successful = results.filter(Result.isSuccess);
        expect(successful).toHaveLength(1);
        const [winner] = successful;
        if (winner === undefined) {
          throw new Error("Concurrent conditional PUT must have one winner");
        }
        const location = winner.success;
        const bytes = yield* store.read(location);
        expect([digestBytes(a), digestBytes(b)]).toContain(digestBytes(bytes));
        const loser = results.find(Result.isFailure);
        if (loser === undefined) {
          throw new Error("Conflicting conditional PUT must have one loser");
        }
        expect(["DigestMismatch", "Unavailable"]).toContain(
          loser.failure.reason
        );
        const winnerInput =
          location.digest === input.expectedDigest ? input : alternate;
        const losingInput =
          location.digest === input.expectedDigest ? alternate : input;
        const replay = yield* store.stage(winnerInput);
        expect((yield* store.stage(losingInput).pipe(Effect.flip)).reason).toBe(
          "DigestMismatch"
        );
        expect({ bytes: yield* store.read(location), replay }).toStrictEqual({
          bytes,
          replay: location,
        });
      })
    )
);

it.live("independent absent bucket does not masquerade as absent capture", () =>
  withStorage(({ config }) =>
    Effect.gen(function* absentBucket() {
      const failed = yield* EvidenceObjectStore.pipe(
        Effect.flatMap((store) => store.locate(reservation(stageInput()))),
        Effect.provide(layer({ ...config, bucket: `${config.bucket}-absent` })),
        Effect.flip
      );
      expect(failed.reason).toBe("Unavailable");
    })
  )
);

it.live("independent relocated World cannot read or delete original key", () =>
  withStorage(() =>
    Effect.gen(function* foreignWorld() {
      const store = yield* EvidenceObjectStore;
      const original = yield* store.stage(stageInput());
      const foreign = stageInput().worldRef;
      const forged = { ...original, worldRef: foreign };
      expect((yield* store.read(forged).pipe(Effect.flip)).reason).toBe(
        "InvalidInput"
      );
      expect((yield* store.remove(forged).pipe(Effect.flip)).reason).toBe(
        "InvalidInput"
      );
      expect(digestBytes(yield* store.read(original))).toBe(original.digest);
    })
  )
);
