import { ErasureLimits } from "@zoen/contracts/erasure/values";
import { describe, expect, it } from "vitest";

import {
  completePurgeOutcomes,
  purgeInventoryWithinBound,
} from "./purge-outcomes.ts";

const first = {
  deleteMarker: false,
  isLatest: false,
  key: "worlds/live/a/version",
  versionId: "null",
};
const second = {
  ...first,
  deleteMarker: true,
  isLatest: true,
  versionId: "opaque-version",
};

describe("purge outcome accounting (pure values, not provider simulations)", () => {
  it("requires an exact one-to-one accounting including literal null and delete markers", () => {
    expect(
      completePurgeOutcomes(
        [first, second],
        [
          { entry: second, outcome: "AlreadyAbsent" },
          { entry: first, outcome: "Removed" },
        ]
      )
    ).toBeTruthy();
    expect(completePurgeOutcomes([], [])).toBeTruthy();
  });

  it("rejects omissions, duplication, wrong targets and unknown outcome spellings", () => {
    for (const actual of [
      [],
      [{ entry: first, outcome: "Removed" }],
      [
        { entry: first, outcome: "Removed" },
        { entry: first, outcome: "Removed" },
      ],
      [
        { entry: first, outcome: "Removed" },
        { entry: { ...second, key: "other" }, outcome: "Removed" },
      ],
      [
        { entry: first, outcome: "Success" },
        { entry: second, outcome: "Removed" },
      ],
    ]) {
      expect(completePurgeOutcomes([first, second], actual)).toBeFalsy();
    }
    expect(
      completePurgeOutcomes(
        [first, first],
        [
          { entry: first, outcome: "Removed" },
          { entry: first, outcome: "Removed" },
        ]
      )
    ).toBeFalsy();
  });

  it("keeps explicit Blocked and Unknown outcomes for the caller to reject", () => {
    expect(
      completePurgeOutcomes([first], [{ entry: first, outcome: "Unknown" }])
    ).toBeTruthy();
  });

  it("admits the honest two-prefix aggregate inventory bound and rejects above it", () => {
    expect(ErasureLimits.versionEntries).toBe(
      ErasureLimits.inventoryPrefixes *
        ErasureLimits.inventoryPagesPerPrefix *
        ErasureLimits.inventoryPageSize
    );
    expect(ErasureLimits.versionEntries).toBeGreaterThan(1_000_000);
    expect(purgeInventoryWithinBound(1_000_001)).toBeTruthy();
    expect(
      purgeInventoryWithinBound(ErasureLimits.versionEntries)
    ).toBeTruthy();
    expect(
      purgeInventoryWithinBound(ErasureLimits.versionEntries + 1)
    ).toBeFalsy();
  });
});
