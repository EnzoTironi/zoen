import { describe, expect, it } from "@effect/vitest";
import { WorldId } from "@zoen/contracts/d01/values";
import { Effect, Schema } from "effect";

import { ErasureObjectInventory } from "../../../src/ports/erasure/inventory.js";
import { ErasurePurgeStore } from "../../../src/ports/erasure/purge.js";

const worldRef = {
  realm: "live" as const,
  worldId: Schema.decodeSync(WorldId)("00000000-0000-4000-8000-000000000044"),
};

describe("EX44 erasure purge ports (unqualified)", () => {
  it.effect("inventory unqualified stays Unavailable", () =>
    Effect.gen(function* blocked() {
      const inventory = yield* ErasureObjectInventory;
      const exit = yield* Effect.exit(inventory.listWorldVersions(worldRef));
      expect(exit._tag).toBe("Failure");
    }).pipe(Effect.provide(ErasureObjectInventory.unqualifiedLayer))
  );

  it.effect("purge unqualified stays Unavailable (no fake Removed)", () =>
    Effect.gen(function* blocked() {
      const purge = yield* ErasurePurgeStore;
      const exit = yield* Effect.exit(
        purge.purgeVersion({
          deleteMarker: false,
          key: "d01/live/00000000-0000-4000-8000-000000000044/captures/x",
          versionId: "null",
        })
      );
      expect(exit._tag).toBe("Failure");
    }).pipe(Effect.provide(ErasurePurgeStore.unqualifiedLayer))
  );
});
