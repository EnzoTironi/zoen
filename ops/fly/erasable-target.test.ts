import { describe, expect, it } from "vitest";

import { admitHostedErasableFlyTarget } from "./erasable-target.ts";

describe("ops/fly erasable-target (ZA-14)", () => {
  it("refuses legacy Fly app zoen before purge/rebind", () => {
    const decision = admitHostedErasableFlyTarget({
      appName: "zoen",
      bucketName: "erasable-proof-bucket",
      imageDigest: "sha256:deadbeef",
      installId: "install-1",
      policyProfileId: "worlds-hosted-erasable-v1",
      volumeName: "erasable_data",
    });
    expect(decision).toMatchObject({
      admitted: false,
      reason: "legacy-app-zoen",
      status: "Blocked",
    });
  });

  it("refuses retained bucket name reuse", () => {
    const decision = admitHostedErasableFlyTarget({
      appName: "zoen-rebuild",
      bucketName: "zoen",
      imageDigest: "sha256:deadbeef",
      installId: "install-1",
      policyProfileId: "worlds-hosted-erasable-v1",
      volumeName: "zoen_data",
    });
    expect(decision).toMatchObject({
      admitted: false,
      reason: "retained-bucket-name-reuse",
      status: "Blocked",
    });
  });

  it("refuses retained install profile", () => {
    const decision = admitHostedErasableFlyTarget({
      appName: "zoen-rebuild",
      bucketName: "erasable-proof-bucket",
      imageDigest: "sha256:deadbeef",
      installId: "install-1",
      policyProfileId: "worlds-hosted-retained-v1",
      volumeName: "zoen_data",
    });
    expect(decision).toMatchObject({
      admitted: false,
      reason: "retained-install-profile",
      status: "Blocked",
    });
  });

  it("keeps full hosted Erased unavailable without H-02", () => {
    expect(
      admitHostedErasableFlyTarget({
        appName: "zoen-erasable-proof",
        bucketName: "erasable-proof-bucket",
        imageDigest: "sha256:deadbeef",
        installId: "install-proof",
        policyProfileId: "worlds-hosted-erasable-v1",
        volumeName: "erasable_data",
      })
    ).toMatchObject({
      admitted: false,
      reason: "gates-incomplete",
      status: "Blocked",
    });
  });
});
