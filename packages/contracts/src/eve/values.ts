import { Schema } from "effect";

import { ClaimRef, EvidenceRef, WorldRef, exact } from "../d01/values.js";

/** Wire schema version for Eve DTOs (distinct from d01.v1 / erasure.v1 / hosted.v1). */
export const EveSchemaVersion = Schema.Literal("eve.v1");
export type EveSchemaVersion = typeof EveSchemaVersion.Type;

/**
 * Candidate local stub profile for disposable Eve proofs only (freeze F07).
 * Does not rebind Worlds / DataPolicy; does not admit real model routing.
 */
export const EveLocalStubProfileId = Schema.Literal("eve-local-stub-v1");
export type EveLocalStubProfileId = typeof EveLocalStubProfileId.Type;

const Uuid = Schema.String.check(Schema.isUUID());

export const ConversationId = Uuid.pipe(Schema.brand("zoen/ConversationId"));
export type ConversationId = typeof ConversationId.Type;

export const RelationshipId = Uuid.pipe(Schema.brand("zoen/RelationshipId"));
export type RelationshipId = typeof RelationshipId.Type;

export const TurnId = Uuid.pipe(Schema.brand("zoen/TurnId"));
export type TurnId = typeof TurnId.Type;

export const IngressId = Uuid.pipe(Schema.brand("zoen/IngressId"));
export type IngressId = typeof IngressId.Type;

export const AttemptId = Uuid.pipe(Schema.brand("zoen/AttemptId"));
export type AttemptId = typeof AttemptId.Type;

export const MessageId = Uuid.pipe(Schema.brand("zoen/MessageId"));
export type MessageId = typeof MessageId.Type;

/** Turn lifecycle for the first increment (subset of SPEC-009). */
export const TurnPhase = Schema.Literals([
  "Accepted",
  "Settled",
  "Cancelled",
  "Interrupted",
]);
export type TurnPhase = typeof TurnPhase.Type;

/** Visible messages only settle; drafts stay provisional. */
export const MessageState = Schema.Literals([
  "Provisional",
  "Visible",
  "Superseded",
]);
export type MessageState = typeof MessageState.Type;

/**
 * Honest uncertainty for grounded composition (freeze F02).
 * Summaries never become evidence (F04) — they may only mark Partial/Unknown.
 */
export const UncertaintyKind = Schema.Literals(["Known", "Partial", "Unknown"]);
export type UncertaintyKind = typeof UncertaintyKind.Type;

/**
 * Provider admission for this increment (F05/F06).
 * Only stub-local may run inference-shaped work in proofs.
 */
export const EveProviderAdmission = Schema.Literals([
  "stub-local",
  "real-model-blocked",
  "voice-blocked",
]);
export type EveProviderAdmission = typeof EveProviderAdmission.Type;

/** Citation to admitted evidence — never authority credentials (F01 / INV-01). */
export const EveEvidenceLink = Schema.Struct({
  claimRef: Schema.NullOr(ClaimRef),
  evidenceRef: EvidenceRef,
}).annotate(exact);
export type EveEvidenceLink = typeof EveEvidenceLink.Type;

/**
 * Journal must not carry authority credentials (INV-01).
 * This literal false is the frozen product default for the stub profile.
 */
export const EveAuthorityCredentialForbidden =
  Schema.Literal(false).annotate(exact);
export type EveAuthorityCredentialForbidden =
  typeof EveAuthorityCredentialForbidden.Type;

/** Conversation header stored in the interaction journal. */
export const EveConversation = Schema.Struct({
  conversationId: ConversationId,
  profileId: EveLocalStubProfileId,
  relationshipId: RelationshipId,
  revision: Schema.String.check(Schema.isPattern(/^(?:0|[1-9][0-9]{0,17})$/u)),
  schemaVersion: EveSchemaVersion,
  worldRef: Schema.NullOr(WorldRef),
}).annotate(exact);
export type EveConversation = typeof EveConversation.Type;

export const EveTurn = Schema.Struct({
  conversationId: ConversationId,
  ingressId: IngressId,
  phase: TurnPhase,
  turnId: TurnId,
  version: Schema.String.check(Schema.isPattern(/^(?:0|[1-9][0-9]{0,17})$/u)),
}).annotate(exact);
export type EveTurn = typeof EveTurn.Type;

export const EveVisibleMessage = Schema.Struct({
  evidenceLinks: Schema.Array(EveEvidenceLink),
  messageId: MessageId,
  state: MessageState,
  turnId: TurnId,
  uncertainty: UncertaintyKind,
  visibleText: Schema.String.check(
    Schema.isMinLength(0),
    Schema.isMaxLength(16_384)
  ),
}).annotate(exact);
export type EveVisibleMessage = typeof EveVisibleMessage.Type;

/** Recoverable snapshot — operational journal, not domain authority. */
export const EveJournalSnapshot = Schema.Struct({
  authorityCredentialPresent: EveAuthorityCredentialForbidden,
  conversation: EveConversation,
  messages: Schema.Array(EveVisibleMessage),
  providerAdmission: EveProviderAdmission,
  turns: Schema.Array(EveTurn),
}).annotate(exact);
export type EveJournalSnapshot = typeof EveJournalSnapshot.Type;
