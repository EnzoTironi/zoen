import { describe, expect, it } from "@effect/vitest";
import {
  WorldAccessInspected,
  WorldReadAccessGranted,
} from "@zoen/contracts/sharing/operations";
import { Schema } from "effect";

import { formatSuccess } from "../../src/worlds/output.js";

describe("EX23 sharing JSON output", () => {
  it("EX23 formatting preserves a historical grant receipt separately from a current revoked membership", () => {
    const principalRef = "33333333-3333-4333-8333-333333333333";
    const worldRef = {
      realm: "live",
      worldId: "22222222-2222-4222-8222-222222222222",
    } as const;
    const receipt = Schema.decodeSync(WorldReadAccessGranted)({
      _tag: "WorldReadAccessGranted",
      membershipAtCommit: {
        principalRef,
        revision: "0",
        role: "viewer",
        state: "active",
      },
      receiptRef: "44444444-4444-4444-8444-444444444444",
      worldRef,
    });
    const current = Schema.decodeSync(WorldAccessInspected)({
      _tag: "WorldAccessInspected",
      membership: {
        principalRef,
        revision: "1",
        role: "viewer",
        state: "revoked",
      },
      worldRef,
    });
    const decode = Schema.decodeSync(Schema.fromJsonString(Schema.Unknown));
    expect(decode(formatSuccess(receipt))).toStrictEqual(receipt);
    expect(decode(formatSuccess(current))).toStrictEqual(current);
    expect(formatSuccess(receipt)).not.toContain('"membership":');
    expect(formatSuccess(current)).not.toContain('"membershipAtCommit":');
  });
});
