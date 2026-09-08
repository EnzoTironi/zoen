import { describe, expect, it } from "@effect/vitest";

import {
  isFullIndependentControllerAdmitted,
  localNarrowControllerQualification,
  unqualifiedControllerQualification,
} from "../../../src/ports/erasure/qualification.js";

describe("ZA-11 controller qualification", () => {
  it("keeps hosted/full independence fail-closed without H-01/G-OPS", () => {
    const local = localNarrowControllerQualification();
    expect(
      isFullIndependentControllerAdmitted(unqualifiedControllerQualification())
    ).toBeFalsy();
    expect(isFullIndependentControllerAdmitted(local)).toBeFalsy();
    expect(local.restoreAfterErasure).toBeFalsy();
    expect(local.h01Approved).toBeFalsy();
    expect(local.gOpsQualified).toBeFalsy();
  });
});
