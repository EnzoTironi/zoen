import type { Digest, WorldRef } from "@zoen/contracts/d01/values";
import type { Effect } from "effect";
import { describe, expectTypeOf, it } from "vitest";

import type {
  CaptureId,
  EvidenceObjectStore,
  ObjectLocation,
  StorageFailure,
} from "../../../src/ports/d01/storage.js";

describe("EX02 storage locate type contract", () => {
  it("EX02 locate requires scoped capture identity and observes a real storage location", () => {
    expectTypeOf<EvidenceObjectStore["Service"]["locate"]>().toEqualTypeOf<
      (input: {
        readonly worldRef: WorldRef;
        readonly captureId: CaptureId;
        readonly expectedDigest: typeof Digest.Type;
        readonly expectedBytes: number;
      }) => Effect.Effect<ObjectLocation, StorageFailure>
    >();
  });
});
