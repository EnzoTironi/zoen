import {
  AcceptConversationTurn,
  CancelConversationTurn,
  RecoverConversationJournal,
} from "@zoen/contracts/eve/operations";
import { InvalidInput } from "@zoen/contracts/worlds/errors";
import type { WorldRef } from "@zoen/contracts/worlds/values";
import { Effect, Schema } from "effect";

const envelope = {
  purpose: "personal-records",
  schemaVersion: "eve.v1",
} as const;

const invalid = () => new InvalidInput({ code: "INVALID_INPUT" });

/** Grounded text path eve-opencode-zen-v1 / opencode-zen (ZA-20 profile). Server fails closed until journal+grounding+G-PROVIDER; tip keeps textProfileAccepted false without live provider proof (ZA-17/19). Domain tools share Inspect. */
export const acceptEveTurnRequest = (
  worldRef: WorldRef,
  input: {
    readonly conversationId: string;
    readonly ingressId: string;
    readonly messageId: string;
    readonly relationshipId: string;
    readonly turnId: string;
    readonly userText: string;
  }
) =>
  Schema.decodeEffect(AcceptConversationTurn)({
    ...envelope,
    input: {
      ...input,
      profileId: "eve-opencode-zen-v1",
      providerAdmission: "opencode-zen",
    },
    operation: "AcceptConversationTurn",
    worldRef,
  }).pipe(Effect.mapError(invalid));

export const cancelEveTurnRequest = (
  worldRef: WorldRef,
  conversationId: string,
  turnId: string
) =>
  Schema.decodeEffect(CancelConversationTurn)({
    ...envelope,
    input: { conversationId, turnId },
    operation: "CancelConversationTurn",
    worldRef,
  }).pipe(Effect.mapError(invalid));

export const recoverEveJournalRequest = (
  worldRef: WorldRef,
  conversationId: string
) =>
  Schema.decodeEffect(RecoverConversationJournal)({
    ...envelope,
    input: { conversationId },
    operation: "RecoverConversationJournal",
    worldRef,
  }).pipe(Effect.mapError(invalid));
