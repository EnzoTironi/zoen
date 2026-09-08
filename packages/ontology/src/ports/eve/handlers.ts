import { randomUUID } from "node:crypto";

import type {
  AcceptConversationTurn,
  CancelConversationTurn,
  EveConversationSuccess,
  RecoverConversationJournal,
  SettleConversationMessage,
} from "@zoen/contracts/eve/operations";
import { AttemptId } from "@zoen/contracts/eve/values";
import { Blocked, Conflict, Unsupported } from "@zoen/contracts/worlds/errors";
import type {
  InvalidInput,
  NotFoundOrDenied,
  Unavailable,
} from "@zoen/contracts/worlds/errors";
import { Effect, Schema } from "effect";
import type { Effect as EffectType } from "effect";

import type { VerifiedRequestContext } from "../worlds/context.js";
import { EveJournal } from "./journal.js";
import type { EveOpenCodeZen } from "./opencode-zen.js";
import { EveTurnService } from "./turn-service.js";

type EveHandlerFailure =
  | Blocked
  | Conflict
  | InvalidInput
  | NotFoundOrDenied
  | Unavailable
  | Unsupported;

const productBlocked = () => new Blocked({ code: "PROFILE_BLOCKED" });

const newAttemptId = () => Schema.decodeSync(AttemptId)(randomUUID());

/** Product HTTP/CLI surface admits only OpenCode Zen free. Stub stays offline-unit only. */
const assertProductAdmission = (
  profileId: AcceptConversationTurn["input"]["profileId"],
  admission: AcceptConversationTurn["input"]["providerAdmission"]
): EffectType.Effect<void, Blocked> => {
  if (admission === "voice-blocked" || admission === "real-model-blocked") {
    return Effect.fail(productBlocked());
  }
  if (admission === "stub-local") {
    return Effect.fail(productBlocked());
  }
  if (admission !== "opencode-zen" || profileId !== "eve-opencode-zen-v1") {
    return Effect.fail(productBlocked());
  }
  return Effect.void;
};

/**
 * Product accept: accept → OpenCode Zen → settle (or idempotent recover of settled ingress).
 * Owner/purpose/world come from verified context + envelope — never request principal fields.
 * Durable intent / CAS fencing lives in the journal adapter (ZA-18).
 */
export const acceptConversationTurn = (
  context: VerifiedRequestContext,
  request: AcceptConversationTurn
): EffectType.Effect<
  EveConversationSuccess,
  EveHandlerFailure,
  EveJournal | EveOpenCodeZen | EveTurnService
> =>
  Effect.gen(function* accept() {
    yield* assertProductAdmission(
      request.input.profileId,
      request.input.providerAdmission
    );
    const journal = yield* EveJournal;
    const turnService = yield* EveTurnService;
    const {
      presence: { principalId: ownerPrincipalId },
      purpose,
    } = context;

    // Fence intent via acceptTurn before any settled replay or provider work.
    const attemptId = newAttemptId();
    const accepted = yield* journal.acceptTurn({
      attemptId,
      conversationId: request.input.conversationId,
      ingressId: request.input.ingressId,
      ownerPrincipalId,
      profileId: request.input.profileId,
      providerAdmission: request.input.providerAdmission,
      purpose,
      relationshipId: request.input.relationshipId,
      turnId: request.input.turnId,
      userText: request.input.userText,
      worldRef: request.worldRef,
    });
    if (accepted.phase === "Cancelled") {
      return yield* new Conflict({ code: "CONFLICT" });
    }
    if (accepted.phase === "Settled") {
      const existing = yield* journal.recover({
        conversationId: request.input.conversationId,
        ownerPrincipalId,
        purpose,
        worldRef: request.worldRef,
      });
      const message = existing.messages.find(
        (row) => row.turnId === accepted.turnId
      );
      if (message === undefined) {
        return yield* new Conflict({ code: "CONFLICT" });
      }
      return {
        _tag: "ConversationMessageSettled" as const,
        conversationId: request.input.conversationId,
        messageId: message.messageId,
        phase: "Settled" as const,
        turnId: accepted.turnId,
        uncertainty: message.uncertainty,
        visibleText: message.visibleText,
      };
    }

    // Accepted: only the lease owner may invoke the provider (ZA-18 CAS).
    const snapshot = yield* journal.recover({
      conversationId: request.input.conversationId,
      ownerPrincipalId,
      purpose,
      worldRef: request.worldRef,
    });
    const lease = snapshot.unresolvedAttempts.find(
      (row) =>
        row.turnId === accepted.turnId &&
        row.state === "unresolved" &&
        row.attemptId === attemptId
    );
    if (lease === undefined) {
      return yield* new Conflict({ code: "CONFLICT" });
    }

    const result = yield* turnService.run({
      attemptId,
      conversationId: request.input.conversationId,
      ingressId: request.input.ingressId,
      messageId: request.input.messageId,
      ownerPrincipalId,
      profileId: request.input.profileId,
      providerAdmission: request.input.providerAdmission,
      purpose,
      relationshipId: request.input.relationshipId,
      turnId: request.input.turnId,
      userText: request.input.userText,
      verifiedContext: context,
      worldRef: request.worldRef,
    });

    return {
      _tag: "ConversationMessageSettled" as const,
      conversationId: request.input.conversationId,
      messageId: result.message.messageId,
      phase: "Settled" as const,
      turnId: result.turn.turnId,
      uncertainty: result.message.uncertainty,
      visibleText: result.message.visibleText,
    };
  });

export const cancelConversationTurn = (
  context: VerifiedRequestContext,
  request: CancelConversationTurn
): EffectType.Effect<EveConversationSuccess, EveHandlerFailure, EveJournal> =>
  Effect.gen(function* cancel() {
    const journal = yield* EveJournal;
    const turn = yield* journal.cancelTurn({
      conversationId: request.input.conversationId,
      ownerPrincipalId: context.presence.principalId,
      purpose: context.purpose,
      turnId: request.input.turnId,
      worldRef: request.worldRef,
    });
    return {
      _tag: "ConversationTurnCancelled" as const,
      conversationId: request.input.conversationId,
      phase: "Cancelled" as const,
      turnId: turn.turnId,
    };
  });

export const recoverConversationJournal = (
  context: VerifiedRequestContext,
  request: RecoverConversationJournal
): EffectType.Effect<EveConversationSuccess, EveHandlerFailure, EveJournal> =>
  Effect.gen(function* recover() {
    const journal = yield* EveJournal;
    const snapshot = yield* journal.recover({
      conversationId: request.input.conversationId,
      ownerPrincipalId: context.presence.principalId,
      purpose: context.purpose,
      worldRef: request.worldRef,
    });
    return {
      _tag: "ConversationJournalRecovered" as const,
      snapshot,
    };
  });

/** Client-facing settle is closed — Visible settlement is server-owned via Accept. */
export const settleConversationMessage = (
  _context: VerifiedRequestContext,
  _request: SettleConversationMessage
): EffectType.Effect<EveConversationSuccess, Unsupported> =>
  Effect.fail(new Unsupported({ code: "UNSUPPORTED" }));
