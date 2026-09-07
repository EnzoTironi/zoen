import { Schema } from "effect";

import { D01Error } from "../d01/errors.js";
import { Purpose, exact } from "../d01/values.js";
import {
  ConversationId,
  EveEvidenceLink,
  EveJournalSnapshot,
  EveLocalStubProfileId,
  EveProviderAdmission,
  EveSchemaVersion,
  IngressId,
  MessageId,
  RelationshipId,
  TurnId,
  UncertaintyKind,
} from "./values.js";

const envelope = {
  purpose: Purpose,
  schemaVersion: EveSchemaVersion,
};

/** Accept a single ingress into the conversation journal (idempotent on ingressId). */
export const AcceptConversationTurn = Schema.Struct({
  ...envelope,
  input: Schema.Struct({
    conversationId: ConversationId,
    ingressId: IngressId,
    profileId: EveLocalStubProfileId,
    providerAdmission: EveProviderAdmission,
    relationshipId: RelationshipId,
    userText: Schema.String.check(
      Schema.isMinLength(1),
      Schema.isMaxLength(16_384)
    ),
  }).annotate(exact),
  operation: Schema.Literal("AcceptConversationTurn"),
}).annotate(exact);
export type AcceptConversationTurn = typeof AcceptConversationTurn.Type;

/** Cancel an accepted turn before settlement. */
export const CancelConversationTurn = Schema.Struct({
  ...envelope,
  input: Schema.Struct({
    conversationId: ConversationId,
    turnId: TurnId,
  }).annotate(exact),
  operation: Schema.Literal("CancelConversationTurn"),
}).annotate(exact);
export type CancelConversationTurn = typeof CancelConversationTurn.Type;

/**
 * Settle a visible grounded message under the stub provider only.
 * Real-model / voice admissions are rejected by the port (F05/F06).
 */
export const SettleConversationMessage = Schema.Struct({
  ...envelope,
  input: Schema.Struct({
    conversationId: ConversationId,
    evidenceLinks: Schema.Array(EveEvidenceLink),
    messageId: MessageId,
    turnId: TurnId,
    uncertainty: UncertaintyKind,
    visibleText: Schema.String.check(
      Schema.isMinLength(0),
      Schema.isMaxLength(16_384)
    ),
  }).annotate(exact),
  operation: Schema.Literal("SettleConversationMessage"),
}).annotate(exact);
export type SettleConversationMessage = typeof SettleConversationMessage.Type;

/** Recover the journal for a conversation without calling a live model. */
export const RecoverConversationJournal = Schema.Struct({
  ...envelope,
  input: Schema.Struct({
    conversationId: ConversationId,
  }).annotate(exact),
  operation: Schema.Literal("RecoverConversationJournal"),
}).annotate(exact);
export type RecoverConversationJournal = typeof RecoverConversationJournal.Type;

export const EveConversationRequest = Schema.Union([
  AcceptConversationTurn,
  CancelConversationTurn,
  SettleConversationMessage,
  RecoverConversationJournal,
]);
export type EveConversationRequest = typeof EveConversationRequest.Type;

export const ConversationTurnAccepted = Schema.TaggedStruct(
  "ConversationTurnAccepted",
  {
    conversationId: ConversationId,
    ingressId: IngressId,
    phase: Schema.Literal("Accepted"),
    turnId: TurnId,
  }
).annotate(exact);

export const ConversationTurnCancelled = Schema.TaggedStruct(
  "ConversationTurnCancelled",
  {
    conversationId: ConversationId,
    phase: Schema.Literal("Cancelled"),
    turnId: TurnId,
  }
).annotate(exact);

export const ConversationMessageSettled = Schema.TaggedStruct(
  "ConversationMessageSettled",
  {
    conversationId: ConversationId,
    messageId: MessageId,
    phase: Schema.Literal("Settled"),
    turnId: TurnId,
    uncertainty: UncertaintyKind,
  }
).annotate(exact);

export const ConversationJournalRecovered = Schema.TaggedStruct(
  "ConversationJournalRecovered",
  {
    snapshot: EveJournalSnapshot,
  }
).annotate(exact);

export const EveConversationSuccess = Schema.Union([
  ConversationTurnAccepted,
  ConversationTurnCancelled,
  ConversationMessageSettled,
  ConversationJournalRecovered,
]);
export type EveConversationSuccess = typeof EveConversationSuccess.Type;

export const EveConversationFailure = D01Error;
export type EveConversationFailure = typeof EveConversationFailure.Type;
