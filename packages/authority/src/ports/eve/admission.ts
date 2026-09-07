import type {
  EveEvidenceLink,
  UncertaintyKind,
} from "@zoen/contracts/eve/values";

/**
 * Product Eve admission gates (ZA-17).
 *
 * A host OpenCode key alone does **not** qualify ownership, durable journal,
 * or evidence grounding. Until ZA-18/ZA-19/ZA-20 proofs land, the product
 * surface stays fail-closed (`Blocked` / unavailable) — never stubMemory or
 * live Zen as a fake-healthy substitute.
 */
export interface ProductEveAdmissionInput {
  /** True when ZOEN_OPENCODE_API_KEY (or equivalent) is configured on the host. */
  readonly openCodeKeyPresent: boolean;
  /** Durable actor-bound journal qualified (ZA-18). */
  readonly durableJournalQualified: boolean;
  /** Evidence-grounded semantic tools qualified (ZA-19). */
  readonly evidenceGroundingQualified: boolean;
  /** Narrow text-conversation profile acceptance recorded (ZA-20). */
  readonly textProfileAccepted: boolean;
}

/**
 * Snapshot of current tip proofs. All qualification flags stay false until
 * later tickets land real durable journal + grounding + profile acceptance.
 */
export const currentProductEveAdmissionInput = (
  openCodeKeyPresent: boolean
): ProductEveAdmissionInput => ({
  durableJournalQualified: false,
  evidenceGroundingQualified: false,
  openCodeKeyPresent,
  textProfileAccepted: false,
});

/** Product Eve is admitted only when key **and** safety proofs are present. */
export const isProductEveAdmitted = (
  input: ProductEveAdmissionInput
): boolean =>
  input.openCodeKeyPresent &&
  input.durableJournalQualified &&
  input.evidenceGroundingQualified &&
  input.textProfileAccepted;

/**
 * Map generation text to uncertainty without treating length as epistemology.
 * Empty → Unknown; any non-empty unsupported prose → Partial — never Known.
 */
export const uncertaintyFromGenerationText = (
  text: string
): UncertaintyKind => {
  if (text.trim().length === 0) {
    return "Unknown";
  }
  return "Partial";
};

/**
 * Factual Known requires at least one authorized evidence link.
 * Long model prose alone cannot set Known (ZA-17-02 / F10).
 */
export const uncertaintyFromEvidenceBasis = (input: {
  readonly evidenceLinks: readonly EveEvidenceLink[];
  readonly generatedText: string;
}): UncertaintyKind => {
  const trimmed = input.generatedText.trim();
  if (trimmed.length === 0) {
    return "Unknown";
  }
  if (input.evidenceLinks.length === 0) {
    return "Partial";
  }
  return "Known";
};
