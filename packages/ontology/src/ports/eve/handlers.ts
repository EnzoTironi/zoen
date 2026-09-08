import type {
  AcceptConversationTurn,
  CancelConversationTurn,
  EveConversationSuccess,
  RecoverConversationJournal,
  SettleConversationMessage,
} from "@zoen/contracts/eve/operations";
import { Blocked, Conflict, Unsupported } from "@zoen/contracts/worlds/errors";
import type {
  NotFoundOrDenied,
  Unavailable,
} from "@zoen/contracts/worlds/errors";
import { Effect } from "effect";
import type { Effect as EffectType } from "effect";

import type { VerifiedRequestContext } from "../worlds/context.js";
import { EveJournal } from "./journal.js";
import type { EveOpenCodeZen } from "./opencode-zen.js";
import { runEveTurn } from "./turn.js";

type EveHandlerFailure =
  | Blocked
  | Conflict
  | NotFoundOrDenied
  | Unavailable
  | Unsupported;

const productBlocked = () => new Blocked({ code: "PROFILE_BLOCKED" });

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
 * Voice / stub-local / missing key stay fail-closed Blocked.
 *
 * Settled-ingress replay avoids unconditional re-call of the model for the same
 * ingressId. Durable intent / owner / race fencing is still absent (ZA-18); this
 * in-memory shortcut is not ownership or crash-recovery proof.
 */
export const acceptConversationTurn = (
  _context: VerifiedRequestContext,
  request: AcceptConversationTurn
): EffectType.Effect<
  EveConversationSuccess,
  EveHandlerFailure,
  EveJournal | EveOpenCodeZen
> =>
  Effect.gen(function* accept() {
    yield* assertProductAdmission(
      request.input.profileId,
      request.input.providerAdmission
    );
    const journal = yield* EveJournal;

    const existing = yield* journal
      .recover(request.input.conversationId)
      .pipe(Effect.catchTag("NotFoundOrDenied", () => Effect.succeed(null)));
    if (existing !== null) {
      const prior = existing.turns.find(
        (turn) => turn.ingressId === request.input.ingressId
      );
      if (prior !== undefined) {
        if (prior.phase === "Settled") {
          const message = existing.messages.find(
            (row) => row.turnId === prior.turnId
          );
          if (message === undefined) {
            return yield* new Conflict({ code: "CONFLICT" });
          }
          return {
            _tag: "ConversationMessageSettled" as const,
            conversationId: request.input.conversationId,
            messageId: message.messageId,
            phase: "Settled" as const,
            turnId: prior.turnId,
            uncertainty: message.uncertainty,
            visibleText: message.visibleText,
          };
        }
        if (prior.phase === "Cancelled") {
          return yield* new Conflict({ code: "CONFLICT" });
        }
      }
    }

    const result = yield* runEveTurn({
      conversationId: request.input.conversationId,
      ingressId: request.input.ingressId,
      messageId: request.input.messageId,
      profileId: request.input.profileId,
      providerAdmission: request.input.providerAdmission,
      relationshipId: request.input.relationshipId,
      turnId: request.input.turnId,
      userText: request.input.userText,
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
  _context: VerifiedRequestContext,
  request: CancelConversationTurn
): EffectType.Effect<EveConversationSuccess, EveHandlerFailure, EveJournal> =>
  Effect.gen(function* cancel() {
    const journal = yield* EveJournal;
    const turn = yield* journal.cancelTurn({
      conversationId: request.input.conversationId,
      turnId: request.input.turnId,
    });
    return {
      _tag: "ConversationTurnCancelled" as const,
      conversationId: request.input.conversationId,
      phase: "Cancelled" as const,
      turnId: turn.turnId,
    };
  });

export const recoverConversationJournal = (
  _context: VerifiedRequestContext,
  request: RecoverConversationJournal
): EffectType.Effect<EveConversationSuccess, EveHandlerFailure, EveJournal> =>
  Effect.gen(function* recover() {
    const journal = yield* EveJournal;
    const snapshot = yield* journal.recover(request.input.conversationId);
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
