/**
 * ZA-20 server wiring for the narrow durable grounded text profile.
 * Ontology owns the qualification record; composition reads it at surface build.
 * Tip stays fail-closed: never default the product gate to acceptedGroundedTextProfile().
 */
import { Redacted } from "effect";

export {
  GROUNDED_TEXT_PROFILE_ID,
  GROUNDED_TEXT_PROVIDER_ADMISSION,
  acceptedGroundedTextProfile,
  groundedTextProfileReady,
  isTextProfileAccepted,
  unqualifiedGroundedTextProfile,
} from "@zoen/ontology/ports/eve/text-profile";
export type { GroundedTextProfileQualification } from "@zoen/ontology/ports/eve/text-profile";

/**
 * Product composition profile gate (ZA-20).
 * Only an explicit `true` opens the gate — omitted/undefined/false stay closed.
 * Do not substitute isTextProfileAccepted(acceptedGroundedTextProfile()).
 */
export const isProductTextProfileGateOpen = (
  textProfileAccepted?: boolean
): boolean => textProfileAccepted === true;

/** Non-blank OpenCode API key required before live G-PROVIDER may install. */
export const hasNonBlankOpenCodeApiKey = (
  apiKey: Redacted.Redacted | undefined
): boolean => {
  if (apiKey === undefined) {
    return false;
  }
  return Redacted.value(apiKey).trim().length > 0;
};
