import { describe, expect, it } from "vitest";

import {
  allowsContentServingReadiness,
  currentRestoreActivationQualification,
  decideRestorePromotion,
  gatesAdmitRestorePromotion,
  linearizeErasureVersusActivation,
  phaseAllowsContentServing,
  phaseAllowsCredentialPromotion,
} from "./restore-activation.ts";

describe("restore activation laws (ZA-13)", () => {
  it("keeps H-01/G-OPS/G-STORAGE-FENCE fail-closed", () => {
    const qualification = currentRestoreActivationQualification();
    expect(qualification.h01).toBe("Blocked");
    expect(qualification.gOps).toBe("Unknown");
    expect(qualification.gStorageFence).toBe("Blocked");
    expect(gatesAdmitRestorePromotion(qualification)).toBeFalsy();
  });

  it("keeps restoreAfterErasure false and Object Lock Unknown", () => {
    const qualification = currentRestoreActivationQualification();
    expect(qualification.restoreAfterErasure).toBeFalsy();
    expect(qualification.objectLockRestoreAfterErasure).toBe("Unknown");
  });

  it("quarantine never serves content or promotes credentials", () => {
    expect(phaseAllowsContentServing("Quarantined")).toBeFalsy();
    expect(phaseAllowsContentServing("Preparing")).toBeFalsy();
    expect(phaseAllowsContentServing("PromotionBlocked")).toBeFalsy();
    expect(phaseAllowsContentServing("Active")).toBeTruthy();
    expect(phaseAllowsCredentialPromotion("Quarantined")).toBeFalsy();
  });

  it("ZA-13-02: unknown controller/rights block content-serving readiness", () => {
    const qualification = currentRestoreActivationQualification();
    expect(
      allowsContentServingReadiness({
        controllerFresh: false,
        phase: "Preparing",
        qualification,
        rightsKnown: true,
      })
    ).toBeFalsy();
    expect(
      allowsContentServingReadiness({
        controllerFresh: true,
        phase: "Preparing",
        qualification,
        rightsKnown: false,
      })
    ).toBeFalsy();
    expect(
      allowsContentServingReadiness({
        controllerFresh: true,
        phase: "NotRestored",
        qualification,
        rightsKnown: true,
      })
    ).toBeTruthy();
  });

  it("ZA-13-03: linearizes erasure vs activation without an admitted erased window", () => {
    const included = linearizeErasureVersusActivation({
      kind: "erasure-admitted-before-drain",
      suppression: { state: "Confirmed" },
    });
    expect(included).toStrictEqual({
      contentAdmitted: false,
      order: "include-erasure-in-cut",
    });

    const deferred = linearizeErasureVersusActivation({
      kind: "erasure-after-drain",
    });
    expect(deferred).toStrictEqual({
      oldEpochAdmitted: false,
      order: "defer-erasure-to-new-epoch",
    });

    const rejected = linearizeErasureVersusActivation({
      kind: "old-writer-resume-after-seal",
    });
    expect(rejected).toStrictEqual({
      contentAdmitted: false,
      order: "reject-old-writer",
    });

    const stale = linearizeErasureVersusActivation({
      kind: "controller-unknown-or-stale",
      suppression: { state: "Unknown" },
    });
    expect(stale).toStrictEqual({
      contentAdmitted: false,
      order: "block-promotion",
    });
  });

  it("promotion stays blocked while gates are unqualified even with a clear cut", () => {
    const decision = decideRestorePromotion({
      catalogCoverage: "BoundedComplete",
      controllerSuppression: { state: "Clear" },
      phase: "Preparing",
      principalRights: "active",
      qualification: currentRestoreActivationQualification(),
      writersSettled: true,
    });
    expect(decision).toStrictEqual({
      admitted: false,
      phase: "PromotionBlocked",
      reason: "gates-unqualified",
    });
  });
});
