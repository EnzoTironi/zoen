import { describe, expect, it } from "@effect/vitest";
import { WorldRef } from "@zoen/contracts/worlds/values";
import { Schema } from "effect";

import {
  isRealmErasureObjectKey,
  worldObjectInventoryPrefixes,
  worldObjectPrefix,
} from "../../../../src/adapters/object-storage/erasure/prefix.js";

describe("EX44 world object prefix", () => {
  const worldRef = Schema.decodeSync(WorldRef)({
    realm: "live",
    worldId: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
  });

  it("derives lowercase World namespace under worlds/live", () => {
    expect(worldObjectPrefix(worldRef)).toBe(
      "worlds/live/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/"
    );
  });

  it("inventories only the canonical worlds/ prefix", () => {
    expect(worldObjectInventoryPrefixes(worldRef)).toStrictEqual([
      "worlds/live/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/",
    ]);
  });

  it("accepts canonical worlds/ keys and rejects residual d01/ keys", () => {
    expect(
      isRealmErasureObjectKey(
        "worlds/live/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/captures/x",
        "live"
      )
    ).toBeTruthy();
    expect(
      isRealmErasureObjectKey(
        "d01/live/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/captures/x",
        "live"
      )
    ).toBeFalsy();
    expect(
      isRealmErasureObjectKey(
        "worlds/other/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/captures/x",
        "live"
      )
    ).toBeFalsy();
    expect(isRealmErasureObjectKey("foreign/live/x", "live")).toBeFalsy();
  });
});
