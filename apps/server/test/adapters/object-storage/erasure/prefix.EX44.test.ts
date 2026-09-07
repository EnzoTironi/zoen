import { describe, expect, it } from "@effect/vitest";
import { WorldRef } from "@zoen/contracts/worlds/values";
import { Schema } from "effect";

import { worldObjectPrefix } from "../../../../src/adapters/object-storage/erasure/prefix.js";

describe("EX44 world object prefix", () => {
  it("derives lowercase World namespace under worlds/live", () => {
    const worldRef = Schema.decodeSync(WorldRef)({
      realm: "live",
      worldId: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
    });
    expect(worldObjectPrefix(worldRef)).toBe(
      "worlds/live/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/"
    );
  });
});
