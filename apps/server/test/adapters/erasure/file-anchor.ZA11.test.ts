import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "@effect/vitest";
import { ErasureExternalAnchor } from "@zoen/authority/ports/erasure/anchor";
import { Effect } from "effect";

import { fileErasureExternalAnchorLayer } from "../../../src/adapters/erasure/file-anchor.ts";

describe("ZA-11 file external anchor", () => {
  it.effect("advances monotonically and refuses rollback", () =>
    Effect.gen(function* fileAnchor() {
      const dir = yield* Effect.tryPromise(() =>
        mkdtemp(path.join(tmpdir(), "za11-unit-anchor-"))
      );
      const filePath = path.join(dir, "seq");
      const layer = fileErasureExternalAnchorLayer(filePath);
      yield* Effect.gen(function* run() {
        const service = yield* ErasureExternalAnchor;
        expect((yield* service.inspect()).admittedSequence).toBe(0n);
        expect((yield* service.advance(2n)).admittedSequence).toBe(2n);
        expect((yield* service.advance(5n)).admittedSequence).toBe(5n);
        const backward = yield* Effect.exit(service.advance(4n));
        expect(backward._tag).toBe("Failure");
        expect(
          yield* Effect.tryPromise(() => readFile(filePath, "utf-8"))
        ).toBe("5\n");
      }).pipe(Effect.provide(layer));
      yield* Effect.tryPromise(() => rm(dir, { force: true, recursive: true }));
    })
  );
});
