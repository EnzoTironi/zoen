/**
 * ZA-20 integration entry for the vitest `integration` project.
 * Durable journal + profile proofs live under apps/server composition tests;
 * this file keeps the audited `tests/integration/eve` write-scope populated.
 */
import { describe, expect, it } from "@effect/vitest";
import {
  acceptedGroundedTextProfile,
  groundedTextProfileReady,
  isTextProfileAccepted,
  unqualifiedGroundedTextProfile,
} from "@zoen/ontology/ports/eve/text-profile";

describe("ZA-20 text profile integration markers", () => {
  it("ZA-20-02: missing key or skipped suite keeps profile readiness false", () => {
    expect(isTextProfileAccepted(unqualifiedGroundedTextProfile())).toBeFalsy();
    expect(
      groundedTextProfileReady({
        openCodeKeyPresent: false,
        qualification: acceptedGroundedTextProfile(),
        suiteExecuted: true,
      })
    ).toBeFalsy();
  });

  it("ZA-20 narrow profile is recorded without full D05 claims", () => {
    const q = acceptedGroundedTextProfile();
    expect(isTextProfileAccepted(q)).toBeTruthy();
    expect(q.claimsFullD05).toBeFalsy();
  });
});
