import { describe, expect, it } from "@effect/vitest";
import { Digest } from "@zoen/contracts/worlds/values";
import { Schema } from "effect";

import type { ControlledCopyRecord } from "../../ports/erasure/copy-catalog.js";
import {
  admitsFullErasureOrRestore,
  blocksAdmission,
  blocksAdmissionByDisposition,
  copyBelongsToWorld,
  isExplainedDisposition,
  isRestoreEligible,
  publicationAllowedDuringClosing,
} from "./copy-catalog.js";

const digest = Schema.decodeSync(Digest)(
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
);

const base = (
  overrides: Partial<ControlledCopyRecord> = {}
): ControlledCopyRecord => ({
  backingSystem: "sql-logical-dump",
  copyId: "11111111-1111-4111-8111-111111111111",
  disposition: "AccountedActive",
  generationId: "gen-1",
  inspectionEvidence: "evidence/local-cut-1",
  integrityDigest: digest,
  ownerPrincipalId: null,
  publishedAt: "2026-09-08T00:00:00.000Z",
  registeredAt: "2026-09-08T00:00:00.000Z",
  rightsRetention: "while-pinned",
  scopeKind: "world",
  worldRef: {
    realm: "live",
    worldId: "22222222-2222-4222-8222-222222222222",
  },
  ...overrides,
});

describe("ZA-12 copy catalog laws", () => {
  it("admits Full Erased/restore only for BoundedComplete", () => {
    expect(admitsFullErasureOrRestore("BoundedComplete")).toBeTruthy();
    expect(admitsFullErasureOrRestore("Unknown")).toBeFalsy();
    expect(admitsFullErasureOrRestore("Incomplete")).toBeFalsy();
    expect(blocksAdmission("Unknown", "restore")).toBeTruthy();
    expect(blocksAdmission("Unknown", "full-erased")).toBeTruthy();
    expect(blocksAdmissionByDisposition("Unaccounted")).toBeTruthy();
    expect(blocksAdmissionByDisposition("Unknown")).toBeTruthy();
    expect(blocksAdmissionByDisposition("AccountedActive")).toBeFalsy();
  });

  it("never treats quarantined or unpublished copies as restore-eligible", () => {
    expect(
      isRestoreEligible(
        base({ disposition: "QuarantinedUnpublishable", publishedAt: null })
      )
    ).toBeFalsy();
    expect(
      isRestoreEligible(base({ disposition: "Unaccounted", publishedAt: null }))
    ).toBeFalsy();
    expect(isRestoreEligible(base())).toBeTruthy();
    expect(
      isRestoreEligible(base({ disposition: "SuppressedOnRestore" }))
    ).toBeTruthy();
  });

  it("scopes world copies without claiming foreign Worlds", () => {
    const copy = base();
    expect(
      copyBelongsToWorld(copy, "22222222-2222-4222-8222-222222222222", "live")
    ).toBeTruthy();
    expect(
      copyBelongsToWorld(copy, "33333333-3333-4333-8333-333333333333", "live")
    ).toBeFalsy();
    expect(
      copyBelongsToWorld(
        base({ scopeKind: "installation", worldRef: null }),
        "22222222-2222-4222-8222-222222222222",
        "live"
      )
    ).toBeFalsy();
  });

  it("orders Closing race: publish only if registered before Closing", () => {
    expect(
      publicationAllowedDuringClosing({
        alreadyRegisteredBeforeClosing: false,
        worldClosing: true,
      })
    ).toBeFalsy();
    expect(
      publicationAllowedDuringClosing({
        alreadyRegisteredBeforeClosing: true,
        worldClosing: true,
      })
    ).toBeTruthy();
    expect(isExplainedDisposition("Erased")).toBeTruthy();
    expect(isExplainedDisposition("Unknown")).toBeFalsy();
  });
});
