/* oxlint-disable effecttsgo/node-builtin-import */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@effect/vitest";
import { CLOUD_SPEECH_ENABLED } from "@zoen/contracts/eve/browser-voice";
import {
  currentHostedErasableQualification,
  gatesAdmitFullHostedErased,
} from "@zoen/ontology/hosted/erasable/admission";
import {
  currentProductEveAdmissionInput,
  isProductEveAdmitted,
} from "@zoen/ontology/ports/eve/admission";
import { Schema } from "effect";

import { cloneStatus, validateFrontierStatus } from "./status.js";
import type { FrontierStatusDocument } from "./status.js";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const statusPath = path.resolve(
  repoRoot,
  "docs/verification/frontier-status.json"
);
const lockPath = path.resolve(repoRoot, "pnpm-lock.yaml");

const EXPECTED_TIP = "85bf4c7a0f3c32b87ffb8eaf0d610d33801a539b";
const EXPECTED_IMAGE_IDENTITY =
  "ghcr.io/enzotironi/zoen/all-in-one@sha256:8852f1df2cb4a53ae245663a018e592c6273fc2e1923dddcd0cd98bab6b7cd55";

const loadStatus = (): FrontierStatusDocument => {
  const raw: unknown = JSON.parse(readFileSync(statusPath, "utf-8"));
  return validateFrontierStatus(raw, {
    expectedCommit: EXPECTED_TIP,
    expectedImageIdentity: EXPECTED_IMAGE_IDENTITY,
    expectedLockfileSha256: createHash("sha256")
      .update(readFileSync(lockPath))
      .digest("hex"),
    requireImageIdentity: true,
  });
};

const asMutableRecord = (value: unknown): Record<string, unknown> => {
  const decoded = Schema.decodeUnknownSync(
    Schema.Record(Schema.String, Schema.Unknown)
  )(value);
  return { ...decoded };
};

describe("ZA-26 frontier integration status", () => {
  it("ZA-26-01: selected finance profile binds tip + concrete demo/evidence paths only", () => {
    const status = loadStatus();

    expect(status.tip.commit).toBe(EXPECTED_TIP);
    expect(status.selectedProfile.ticket).toBe("ZA-25");
    expect(status.selectedProfile.id).toBe("finance-record-reconciliation");

    const paths = [
      status.selectedProfile.browserSpec,
      status.selectedProfile.integrationTest,
      status.selectedProfile.acceptanceReadme,
      status.selectedProfile.productDoc,
      "docs/verification/frontier-integration.md",
      "tests/acceptance/frontier/README.md",
    ];
    for (const relative of paths) {
      expect(existsSync(path.resolve(repoRoot, relative))).toBeTruthy();
    }

    expect(status.selectedProfile.evidenceRef).toContain("za-25");
    expect(status.scopes.implemented).toStrictEqual(
      expect.arrayContaining([
        expect.stringContaining("za-25-finance"),
        expect.stringContaining("za-22-household"),
        expect.stringContaining("za-23-bakery"),
        expect.stringContaining("za-24-clinic"),
      ])
    );
    expect(status.execution.selectedProfileIntegrationTests).toBeGreaterThan(0);
    expect(status.execution.selectedProfileAcceptanceTests).toBeGreaterThan(0);
    expect(
      status.execution.commands.some((command) => command.includes("finance"))
    ).toBeTruthy();
    expect(status.tip.imageIdentity).toBe(EXPECTED_IMAGE_IDENTITY);
    expect(status.conditionalGates.entireTargetDiagramImplemented).toBeFalsy();
    expect(status.scopes.activated).toStrictEqual([]);
  });

  it("ZA-26-02: missing conditional gates keep dependent capabilities blocked; ICPs retained", () => {
    const status = loadStatus();

    expect(status.conditionalGates["H-01"]).toBe("Blocked");
    expect(status.conditionalGates["H-02"]).toBe("Blocked");
    expect(status.conditionalGates["G-PROVIDER"]).toBe("Blocked");
    expect(status.conditionalGates["G-STORAGE-FENCE"]).toBe("Blocked");
    expect(status.conditionalGates["G-OPS"]).toBe("Unknown");
    expect(status.conditionalGates.textProfileAccepted).toBeFalsy();
    expect(status.conditionalGates.fullHostedErased).toBeFalsy();
    expect(status.conditionalGates.cloudSpeechEnabled).toBeFalsy();
    expect(status.conditionalGates.restoreAfterErasure).toBeFalsy();
    expect(status.conditionalGates.fullD03).toBeFalsy();
    expect(status.conditionalGates.fullD04).toBeFalsy();
    expect(status.conditionalGates.fullD05).toBeFalsy();
    expect(status.conditionalGates.activatedBecausePrMerged).toBeFalsy();

    for (const blocked of [
      "independent-erasure-controller",
      "hosted-erased-activated",
      "eve-product-admitted",
      "cloud-speech",
      "restore-after-erasure",
      "full-d03",
      "full-d04",
      "full-d05",
    ]) {
      expect(status.scopes.blocked).toContain(blocked);
    }

    expect(status.scopes.implemented).toStrictEqual(
      expect.arrayContaining([
        expect.stringMatching(/za-22/u),
        expect.stringMatching(/za-23/u),
        expect.stringMatching(/za-24/u),
        expect.stringMatching(/za-25/u),
      ])
    );

    const eve = currentProductEveAdmissionInput(false, {
      durableJournalQualified: true,
      evidenceGroundingQualified: true,
      textProfileAccepted: false,
    });
    expect(isProductEveAdmitted(eve)).toBeFalsy();
    expect(CLOUD_SPEECH_ENABLED).toBeFalsy();

    const hosted = currentHostedErasableQualification();
    expect(hosted.fullHostedErased).toBeFalsy();
    expect(hosted.productAccepted).toBeFalsy();
    expect(hosted.h01).toBe("Blocked");
    expect(hosted.gStorageFence).toBe("Blocked");
    expect(gatesAdmitFullHostedErased(hosted)).toBeFalsy();
  });

  it("ZA-26-03: old commit / wrong image / zero tests are rejected", () => {
    const status = loadStatus();

    const oldCommit = asMutableRecord(cloneStatus(status));
    oldCommit.tip = {
      ...asMutableRecord(oldCommit.tip),
      commit: "ed5ca86708ed03c6f4080994395819289205d547",
      short: "ed5ca86",
    };
    expect(() =>
      validateFrontierStatus(oldCommit, { expectedCommit: EXPECTED_TIP })
    ).toThrow(/old\/cross-commit|does not match expected tip/iu);

    const wrongImage = asMutableRecord(cloneStatus(status));
    wrongImage.tip = {
      ...asMutableRecord(wrongImage.tip),
      imageIdentity: `sha256:${"c".repeat(64)}`,
    };
    expect(() =>
      validateFrontierStatus(wrongImage, {
        expectedCommit: EXPECTED_TIP,
        expectedImageIdentity: EXPECTED_IMAGE_IDENTITY,
        requireImageIdentity: true,
      })
    ).toThrow(/image/iu);

    const missingImage = asMutableRecord(cloneStatus(status));
    missingImage.tip = {
      ...asMutableRecord(missingImage.tip),
      imageIdentity: null,
    };
    expect(() =>
      validateFrontierStatus(missingImage, {
        expectedCommit: EXPECTED_TIP,
        expectedImageIdentity: EXPECTED_IMAGE_IDENTITY,
        requireImageIdentity: true,
      })
    ).toThrow(/image/iu);

    const zeroTests = asMutableRecord(cloneStatus(status));
    zeroTests.execution = {
      ...asMutableRecord(zeroTests.execution),
      unitTests: 0,
    };
    expect(() =>
      validateFrontierStatus(zeroTests, { expectedCommit: EXPECTED_TIP })
    ).toThrow(/unitTests|schema rejected/iu);

    const cumulative = asMutableRecord(cloneStatus(status));
    cumulative.execution = {
      ...asMutableRecord(cumulative.execution),
      historicalCumulativeTests: 975,
    };
    expect(() =>
      validateFrontierStatus(cumulative, { expectedCommit: EXPECTED_TIP })
    ).toThrow(/historicalCumulativeTests/iu);

    const activated = asMutableRecord(cloneStatus(status));
    activated.scopes = {
      ...asMutableRecord(activated.scopes),
      activated: ["full-product"],
    };
    expect(() =>
      validateFrontierStatus(activated, { expectedCommit: EXPECTED_TIP })
    ).toThrow(/activated/iu);

    const dropIcp = asMutableRecord(cloneStatus(status));
    const scopes = asMutableRecord(dropIcp.scopes);
    const { implemented } = scopes;
    if (!Array.isArray(implemented)) {
      throw new TypeError("implemented must be an array");
    }
    dropIcp.scopes = {
      ...scopes,
      implemented: implemented.filter(
        (item) => typeof item === "string" && !item.includes("za-22")
      ),
    };
    expect(() =>
      validateFrontierStatus(dropIcp, { expectedCommit: EXPECTED_TIP })
    ).toThrow(/za-22/iu);

    const zeroAcceptance = asMutableRecord(cloneStatus(status));
    zeroAcceptance.execution = {
      ...asMutableRecord(zeroAcceptance.execution),
      selectedProfileAcceptanceTests: 0,
    };
    expect(() =>
      validateFrontierStatus(zeroAcceptance, { expectedCommit: EXPECTED_TIP })
    ).toThrow(/selectedProfileAcceptanceTests|schema rejected/iu);

    const qualifyFull = asMutableRecord(cloneStatus(status));
    const qualifyScopes = asMutableRecord(qualifyFull.scopes);
    const qualifiedItems = Schema.decodeUnknownSync(
      Schema.Array(Schema.String)
    )(qualifyScopes.qualified);
    qualifyFull.scopes = {
      ...qualifyScopes,
      qualified: [...qualifiedItems, "full-d03"],
    };
    expect(() =>
      validateFrontierStatus(qualifyFull, { expectedCommit: EXPECTED_TIP })
    ).toThrow(/scopes\.qualified|full D03/iu);

    const wrongGate = asMutableRecord(cloneStatus(status));
    wrongGate.conditionalGates = {
      ...asMutableRecord(wrongGate.conditionalGates),
      "H-01": "Unknown",
    };
    expect(() =>
      validateFrontierStatus(wrongGate, { expectedCommit: EXPECTED_TIP })
    ).toThrow(/conditionalGates\.H-01/iu);

    const opsBlocked = asMutableRecord(cloneStatus(status));
    opsBlocked.conditionalGates = {
      ...asMutableRecord(opsBlocked.conditionalGates),
      "G-OPS": "Blocked",
    };
    expect(() =>
      validateFrontierStatus(opsBlocked, { expectedCommit: EXPECTED_TIP })
    ).toThrow(/conditionalGates\.G-OPS/iu);
  });
});
