import { describe, expect, it } from "@effect/vitest";

import { assertFullControllerNotActivated } from "../../../src/erasure/controller-gate.js";
import {
  isFullIndependentControllerAdmitted,
  localNarrowControllerQualification,
  unqualifiedControllerQualification,
} from "../../../src/ports/erasure/qualification.js";

describe("ZA-11 controller qualification", () => {
  it("keeps hosted/full independence fail-closed without H-01/G-OPS", () => {
    const local = localNarrowControllerQualification();
    const unqualified = unqualifiedControllerQualification();
    expect(isFullIndependentControllerAdmitted(unqualified)).toBeFalsy();
    expect(isFullIndependentControllerAdmitted(local)).toBeFalsy();
    expect(assertFullControllerNotActivated(unqualified)).toBeTruthy();
    expect(assertFullControllerNotActivated(local)).toBeTruthy();
    expect(local.restoreAfterErasure).toBeFalsy();
  });

  it("records local-narrow gates without inventing H-01/G-OPS", () => {
    const local = localNarrowControllerQualification();
    expect(local.h01Approved).toBeFalsy();
    expect(local.gOpsQualified).toBeFalsy();
    expect(local.localNarrowRollbackSeparation).toBeTruthy();
  });
});
