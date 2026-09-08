import { describe, expect, it } from "@effect/vitest";
import { HostedErasableTarget } from "@zoen/contracts/hosted/erasable/values";
import { Schema } from "effect";

import {
  LEGACY_FLY_APP,
  RETAINED_BUCKET_NAME,
  currentHostedErasableQualification,
  evaluateHostedErasableAdmission,
  gatesAdmitFullHostedErased,
  localExactImageProofQualification,
  refuseProtectedResource,
} from "../../../src/hosted/erasable/admission.js";

const proofTarget = Schema.decodeSync(HostedErasableTarget)({
  appName: "zoen-erasable-proof",
  bucketName: "erasable-proof-bucket",
  imageDigest: "sha256:za14localexact",
  installId: "install-za14-proof",
  profileId: "worlds-hosted-erasable-v1",
  volumeName: "erasable_proof_data",
});

describe("ZA-14 hosted erasable admission", () => {
  it("keeps product gates Blocked/Unknown", () => {
    const qualification = currentHostedErasableQualification();
    expect(qualification).toMatchObject({
      gOps: "Unknown",
      gStorageFence: "Blocked",
      h01: "Blocked",
      h02: "Blocked",
    });
  });

  it("keeps Full hosted Erased and restoreAfterErasure closed", () => {
    const qualification = currentHostedErasableQualification();
    expect(qualification.fullHostedErased).toBeFalsy();
    expect(qualification.productAccepted).toBeFalsy();
    expect(qualification.restoreAfterErasure).toBeFalsy();
    expect(gatesAdmitFullHostedErased(qualification)).toBeFalsy();
  });

  it("ZA-14-02 refuses legacy app, retained profile, and retained bucket reuse", () => {
    expect(
      refuseProtectedResource({
        appName: LEGACY_FLY_APP,
        bucketName: "other",
        imageDigest: "sha256:x",
        installId: "i",
        policyProfileId: "worlds-hosted-erasable-v1",
        volumeName: "v",
      })
    ).toMatchObject({ admitted: false, reason: "legacy-app-zoen" });

    expect(
      refuseProtectedResource({
        appName: "zoen-rebuild",
        bucketName: "other",
        imageDigest: "sha256:x",
        installId: "i",
        policyProfileId: "worlds-hosted-retained-v1",
        volumeName: "v",
      })
    ).toMatchObject({ admitted: false, reason: "retained-install-profile" });

    expect(
      refuseProtectedResource({
        appName: "zoen-rebuild",
        bucketName: RETAINED_BUCKET_NAME,
        imageDigest: "sha256:x",
        installId: "i",
        policyProfileId: "worlds-hosted-erasable-v1",
        volumeName: "v",
      })
    ).toMatchObject({
      admitted: false,
      reason: "retained-bucket-name-reuse",
    });
  });

  it("ZA-14-01 admits local exact-image proof Closing without product activation", () => {
    const qualification = localExactImageProofQualification(proofTarget);
    expect(qualification.localExactImageProofAdmitted).toBeTruthy();
    expect(qualification.productAccepted).toBeFalsy();
    expect(gatesAdmitFullHostedErased(qualification)).toBeFalsy();

    const closing = evaluateHostedErasableAdmission({
      candidate: {
        appName: proofTarget.appName,
        bucketName: proofTarget.bucketName,
        imageDigest: proofTarget.imageDigest,
        installId: proofTarget.installId,
        policyProfileId: "worlds-hosted-erasable-v1",
        volumeName: proofTarget.volumeName,
      },
      catalogCoverage: "Unknown",
      controllerAvailable: true,
      heldObject: false,
      purpose: "closing",
      qualification,
    });
    expect(closing).toMatchObject({
      admitted: true,
      mode: "local-exact-image-proof",
    });
  });

  it("ZA-14-03 blocks purge on controller/catalog/hold failures", () => {
    const qualification = localExactImageProofQualification(proofTarget);
    const candidate = {
      appName: proofTarget.appName,
      bucketName: proofTarget.bucketName,
      imageDigest: proofTarget.imageDigest,
      installId: proofTarget.installId,
      policyProfileId: "worlds-hosted-erasable-v1" as const,
      volumeName: proofTarget.volumeName,
    };

    expect(
      evaluateHostedErasableAdmission({
        candidate,
        catalogCoverage: "BoundedComplete",
        controllerAvailable: false,
        heldObject: false,
        purpose: "purge",
        qualification,
      })
    ).toMatchObject({
      admitted: false,
      reason: "controller-unavailable",
      status: "Unknown",
    });

    expect(
      evaluateHostedErasableAdmission({
        candidate,
        catalogCoverage: "Incomplete",
        controllerAvailable: true,
        heldObject: false,
        purpose: "purge",
        qualification,
      })
    ).toMatchObject({
      admitted: false,
      reason: "incomplete-catalog",
      status: "Blocked",
    });

    expect(
      evaluateHostedErasableAdmission({
        candidate,
        catalogCoverage: "BoundedComplete",
        controllerAvailable: true,
        heldObject: true,
        purpose: "purge",
        qualification,
      })
    ).toMatchObject({
      admitted: false,
      reason: "held-object",
      status: "Blocked",
    });

    expect(
      evaluateHostedErasableAdmission({
        candidate,
        catalogCoverage: "BoundedComplete",
        controllerAvailable: true,
        heldObject: false,
        purpose: "full-erased",
        qualification,
      })
    ).toMatchObject({
      admitted: false,
      reason: "gates-incomplete",
      status: "Blocked",
    });
  });
});
