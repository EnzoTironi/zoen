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
 * Snapshot of current tip proofs. Evidence grounding may be marked when ZA-19
 * composition wires tools. Text-profile acceptance is opt-in (ZA-20); without
 * G-PROVIDER live qualification the tip keeps it false. G-PROVIDER (live Zen)
 * remains a separate qualification gate.
 */
export const currentProductEveAdmissionInput = (
  openCodeKeyPresent: boolean,
  options?: {
    readonly durableJournalQualified?: boolean;
    readonly evidenceGroundingQualified?: boolean;
    readonly textProfileAccepted?: boolean;
  }
): ProductEveAdmissionInput => ({
  // ZA-18 sets durableJournalQualified when a restricted journal identity is wired.
  // ZA-19 sets evidenceGroundingQualified when grounded TurnService is composed.
  // ZA-20 sets textProfileAccepted only when the narrow grounded text profile is
  // recorded **and** the host opts in — tip stays false without G-PROVIDER proof.
  durableJournalQualified: options?.durableJournalQualified === true,
  evidenceGroundingQualified: options?.evidenceGroundingQualified === true,
  openCodeKeyPresent,
  textProfileAccepted: options?.textProfileAccepted === true,
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
 * Factual Known requires a **verified authorized** evidence basis.
 * Identifier-only `EveEvidenceLink` values are never sufficient (ZA-17 / F10):
 * callers must set `citationsAuthorized` only after each cited evidenceRef has
 * been resolved and authorized for the request world / principal / claim
 * context (ZA-19). Unverified or unauthorized links keep Partial.
 * Long model prose alone cannot set Known.
 */
export const uncertaintyFromEvidenceBasis = (input: {
  /**
   * True only after cited links were resolved and authorized for this turn.
   * Raw nonempty `evidenceLinks` without this flag must not imply Known.
   */
  readonly citationsAuthorized: boolean;
  readonly evidenceLinks: readonly EveEvidenceLink[];
  readonly generatedText: string;
}): UncertaintyKind => {
  const trimmed = input.generatedText.trim();
  if (trimmed.length === 0) {
    return "Unknown";
  }
  if (!(input.citationsAuthorized && input.evidenceLinks.length > 0)) {
    return "Partial";
  }
  return "Known";
};
