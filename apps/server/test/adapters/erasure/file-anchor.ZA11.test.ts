import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { ErasureExternalAnchor } from "@zoen/ontology/ports/erasure/anchor";
import { Effect, FileSystem } from "effect";

import { fileErasureExternalAnchorLayer } from "../../../src/adapters/erasure/file-anchor.ts";

describe("ZA-11 file external anchor", () => {
  it.effect("advances monotonically and refuses rollback", () =>
    Effect.gen(function* fileAnchor() {
      const fs = yield* FileSystem.FileSystem;
      const dir = yield* fs.makeTempDirectoryScoped({
        prefix: "za11-unit-anchor-",
      });
      const filePath = `${dir}/seq`;
      const layer = fileErasureExternalAnchorLayer(filePath);
      yield* Effect.gen(function* run() {
        const service = yield* ErasureExternalAnchor;
        expect((yield* service.inspect).admittedSequence).toBe(0n);
        expect((yield* service.advance(2n)).admittedSequence).toBe(2n);
        expect((yield* service.advance(5n)).admittedSequence).toBe(5n);
        const backward = yield* Effect.result(service.advance(4n));
        expect(backward._tag).toBe("Failure");
        expect(yield* fs.readFileString(filePath)).toBe("5\n");
      }).pipe(Effect.provide(layer));
    }).pipe(Effect.provide(NodeServices.layer))
  );
});
