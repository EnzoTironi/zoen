/**
 * ZA-14 Fly target binding helpers. No remote destructive steps.
 * Evaluates whether a candidate hosted install may receive erasable policy.
 */
import {
  currentHostedErasableQualification,
  evaluateHostedErasableAdmission,
  refuseProtectedResource,
} from "../../packages/authority/src/hosted/erasable/admission.ts";
import type { HostedErasableCandidate } from "../../packages/authority/src/hosted/erasable/admission.ts";

export const LEGACY_FLY_APP = "zoen" as const;
export const RETAINED_HOSTED_APP = "zoen-rebuild" as const;
export const RETAINED_BUCKET = "zoen" as const;

/** Build a candidate from operator-supplied exact identities (H-02). */
export const hostedErasableCandidate = (
  input: HostedErasableCandidate
): HostedErasableCandidate => input;

/**
 * Read-only admission check for an exact target. Never destroys apps/buckets.
 * Current product posture: always Blocked/Unknown without H-02 qualification.
 */
export const admitHostedErasableFlyTarget = (
  candidate: HostedErasableCandidate
) => {
  const protectedDecision = refuseProtectedResource(candidate);
  if (protectedDecision !== null) {
    return protectedDecision;
  }
  // Even with optimistic controller/catalog assumptions, product gates stay closed.
  return evaluateHostedErasableAdmission({
    candidate,
    catalogCoverage: "BoundedComplete",
    controllerAvailable: true,
    heldObject: false,
    purpose: "full-erased",
    qualification: currentHostedErasableQualification(),
  });
};
