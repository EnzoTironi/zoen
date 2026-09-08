/**
 * ZA-20 server wiring for the narrow durable grounded text profile.
 * Ontology owns the qualification record; composition reads it at surface build.
 */
export {
  GROUNDED_TEXT_PROFILE_ID,
  GROUNDED_TEXT_PROVIDER_ADMISSION,
  acceptedGroundedTextProfile,
  groundedTextProfileReady,
  isTextProfileAccepted,
  unqualifiedGroundedTextProfile,
} from "@zoen/ontology/ports/eve/text-profile";
export type { GroundedTextProfileQualification } from "@zoen/ontology/ports/eve/text-profile";
