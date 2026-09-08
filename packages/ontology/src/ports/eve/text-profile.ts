/**
 * ZA-20 — narrow durable grounded text-conversation profile qualification.
 *
 * Records acceptance for `eve-opencode-zen-v1` / `opencode-zen` only. Full D05,
 * multi-provider routing, compaction, and cloud voice stay outside this profile.
 * Product activation still requires durable journal (ZA-18), evidence grounding
 * (ZA-19), and G-PROVIDER (live OpenCode key in env/Fly secrets — never committed).
 */

import type {
  EveOpenCodeZenProfileId,
  EveProviderAdmission,
} from "@zoen/contracts/eve/values";

/** Narrow text profile this ticket may accept. */
export const GROUNDED_TEXT_PROFILE_ID =
  "eve-opencode-zen-v1" as const satisfies EveOpenCodeZenProfileId;

/** Provider admission paired with the grounded text profile. */
export const GROUNDED_TEXT_PROVIDER_ADMISSION =
  "opencode-zen" as const satisfies EveProviderAdmission;

/**
 * Qualification record for the durable grounded text conversation profile.
 * `profileAccepted` is the ZA-20 gate; it does not claim D05 activated.
 */
export interface GroundedTextProfileQualification {
  /** Evidence-bound semantic tools (ZA-19) remain a separate admission gate. */
  readonly evidenceGroundingRequired: true;
  /** Live OpenCode Zen key must be present at runtime (G-PROVIDER). */
  readonly gProviderRequired: true;
  /** Actor-owned durable journal (ZA-18) remains a separate admission gate. */
  readonly journalDurableRequired: true;
  /** True only after ZA-20 proofs record this narrow profile. */
  readonly profileAccepted: boolean;
  readonly profileId: typeof GROUNDED_TEXT_PROFILE_ID;
  readonly providerAdmission: typeof GROUNDED_TEXT_PROVIDER_ADMISSION;
  /** Never claim full D05 from this narrow profile alone. */
  readonly claimsFullD05: false;
  /** Cloud STT/TTS / multi-provider routing stay outside acceptance. */
  readonly claimsCloudVoiceOrRouting: false;
}

/** Default until ZA-20 records acceptance — product Eve stays unadmitted. */
export const unqualifiedGroundedTextProfile =
  (): GroundedTextProfileQualification => ({
    claimsCloudVoiceOrRouting: false,
    claimsFullD05: false,
    evidenceGroundingRequired: true,
    gProviderRequired: true,
    journalDurableRequired: true,
    profileAccepted: false,
    profileId: GROUNDED_TEXT_PROFILE_ID,
    providerAdmission: GROUNDED_TEXT_PROVIDER_ADMISSION,
  });

/**
 * Narrow profile acceptance recorded by ZA-20.
 * Does **not** set product Eve activated — journal, grounding, and G-PROVIDER
 * remain independent gates on `ProductEveAdmissionInput`.
 */
export const acceptedGroundedTextProfile =
  (): GroundedTextProfileQualification => ({
    claimsCloudVoiceOrRouting: false,
    claimsFullD05: false,
    evidenceGroundingRequired: true,
    gProviderRequired: true,
    journalDurableRequired: true,
    profileAccepted: true,
    profileId: GROUNDED_TEXT_PROFILE_ID,
    providerAdmission: GROUNDED_TEXT_PROVIDER_ADMISSION,
  });

/** ZA-20 admission flag derived from the qualification record. */
export const isTextProfileAccepted = (
  qualification: GroundedTextProfileQualification
): boolean =>
  qualification.profileAccepted &&
  qualification.profileId === GROUNDED_TEXT_PROFILE_ID &&
  qualification.providerAdmission === GROUNDED_TEXT_PROVIDER_ADMISSION &&
  !qualification.claimsFullD05 &&
  !qualification.claimsCloudVoiceOrRouting;

/**
 * Provider-profile execution missing required configuration fails closed.
 * Used by composition/tests so skipped suites never flip `textProfileAccepted`.
 */
export const groundedTextProfileReady = (input: {
  readonly openCodeKeyPresent: boolean;
  readonly qualification: GroundedTextProfileQualification;
  readonly suiteExecuted: boolean;
}): boolean =>
  input.suiteExecuted &&
  input.openCodeKeyPresent &&
  isTextProfileAccepted(input.qualification);
