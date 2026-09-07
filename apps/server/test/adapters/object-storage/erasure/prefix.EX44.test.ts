import { describe, expect, it } from "@effect/vitest";
import { WorldRef } from "@zoen/contracts/worlds/values";
import { Schema } from "effect";

import {
  isRealmErasureObjectKey,
  legacyWorldObjectPrefix,
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

  it("exposes pre-launch residual d01/ namespace for scrubbing", () => {
    expect(legacyWorldObjectPrefix(worldRef)).toBe(
      "d01/live/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/"
    );
    expect(worldObjectInventoryPrefixes(worldRef)).toStrictEqual([
      "worlds/live/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/",
      "d01/live/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/",
    ]);
  });

  it("accepts canonical worlds/ and residual d01/ keys in-realm", () => {
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
    ).toBeTruthy();
    expect(
      isRealmErasureObjectKey(
        "worlds/other/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/captures/x",
        "live"
      )
    ).toBeFalsy();
    expect(isRealmErasureObjectKey("foreign/live/x", "live")).toBeFalsy();
  });
});
