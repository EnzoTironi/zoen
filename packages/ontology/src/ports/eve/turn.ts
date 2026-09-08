import type {
  AttemptId,
  ConversationId,
  EveEvidenceLink,
  EveProfileId,
  EveProviderAdmission,
  EveTurn,
  EveVisibleMessage,
  IngressId,
  MessageId,
  RelationshipId,
  TurnId,
} from "@zoen/contracts/eve/values";
import {
  Blocked,
  Conflict,
  NotFoundOrDenied,
  Unavailable,
} from "@zoen/contracts/worlds/errors";
import type { WorldRef } from "@zoen/contracts/worlds/values";
// oxlint-disable-next-line typescript/consistent-type-imports -- Schema value for typeof Purpose.Type
import { Purpose } from "@zoen/contracts/worlds/values";
import { Effect } from "effect";
import type { Effect as EffectType } from "effect";

// oxlint-disable-next-line typescript/consistent-type-imports -- Schema value for typeof PrincipalId.Type
import { PrincipalId } from "../worlds/context.js";
import { uncertaintyFromEvidenceBasis } from "./admission.js";
import { EveJournal } from "./journal.js";
import { EveOpenCodeZen } from "./opencode-zen.js";

export interface RunEveTurnInput {
  readonly attemptId: AttemptId;
  readonly conversationId: ConversationId;
  readonly evidenceLinks?: readonly EveEvidenceLink[];
  readonly ingressId: IngressId;
  readonly messageId: MessageId;
  readonly ownerPrincipalId: typeof PrincipalId.Type;
  readonly profileId: EveProfileId;
  readonly providerAdmission: EveProviderAdmission;
  readonly purpose: typeof Purpose.Type;
  readonly relationshipId: RelationshipId;
  readonly signal?: AbortSignal;
  readonly systemText?: string;
  readonly turnId: TurnId;
  readonly userText: string;
  readonly worldRef?: WorldRef | null;
}

export interface RunEveTurnResult {
  readonly message: EveVisibleMessage;
  readonly turn: EveTurn;
}

type TurnFailure = Blocked | Conflict | NotFoundOrDenied | Unavailable;

/**
 * Product turn path: accept → live model → settle.
 * Text: `opencode-zen`. Voice journal admission `web-speech` still settles via
 * OpenCode Zen text completion (STT/TTS live in the browser surface).
 * Cancel (or AbortSignal) must abort before settle — never fabricate Visible.
 */
export const runEveTurn = (
  input: RunEveTurnInput
): EffectType.Effect<
  RunEveTurnResult,
  TurnFailure,
  EveJournal | EveOpenCodeZen
> =>
  Effect.gen(function* turn() {
    const journal = yield* EveJournal;
    const model = yield* EveOpenCodeZen;
    const worldRef = input.worldRef ?? null;

    if (input.providerAdmission === "voice-blocked") {
      return yield* new Blocked({ code: "PROFILE_BLOCKED" });
    }
    if (input.providerAdmission === "real-model-blocked") {
      return yield* new Blocked({ code: "PROFILE_BLOCKED" });
    }
    if (
      input.providerAdmission === "opencode-zen" &&
      input.profileId !== "eve-opencode-zen-v1"
    ) {
      return yield* new Blocked({ code: "PROFILE_BLOCKED" });
    }
    if (
      input.providerAdmission === "web-speech" &&
      input.profileId !== "eve-web-speech-v1"
    ) {
      return yield* new Blocked({ code: "PROFILE_BLOCKED" });
    }
    if (
      input.providerAdmission === "stub-local" &&
      input.profileId !== "eve-local-stub-v1"
    ) {
      return yield* new Blocked({ code: "PROFILE_BLOCKED" });
    }

    const accepted = yield* journal.acceptTurn({
      attemptId: input.attemptId,
      conversationId: input.conversationId,
      ingressId: input.ingressId,
      ownerPrincipalId: input.ownerPrincipalId,
      profileId: input.profileId,
      providerAdmission: input.providerAdmission,
      purpose: input.purpose,
      relationshipId: input.relationshipId,
      turnId: input.turnId,
      userText: input.userText,
      worldRef,
    });

    const signalAborted = (): boolean =>
      input.signal !== undefined && input.signal.aborted;
    if (signalAborted()) {
      yield* journal.cancelTurn({
        conversationId: input.conversationId,
        ownerPrincipalId: input.ownerPrincipalId,
        purpose: input.purpose,
        turnId: input.turnId,
        worldRef,
      });
      return yield* new Unavailable({ code: "UNAVAILABLE" });
    }

    // Stub-local offline proofs settle a deterministic placeholder without network.
    if (input.providerAdmission === "stub-local") {
      const message = yield* journal.settleMessage({
        attemptId: input.attemptId,
        conversationId: input.conversationId,
        evidenceLinks: [...(input.evidenceLinks ?? [])],
        messageId: input.messageId,
        ownerPrincipalId: input.ownerPrincipalId,
        purpose: input.purpose,
        turnId: input.turnId,
        uncertainty: "Partial",
        visibleText: "[stub-local] offline proof — not a live model reply",
        worldRef,
      });
      return {
        message,
        turn: { ...accepted, phase: "Settled" as const },
      };
    }

    const chatInput = {
      conversationId: input.conversationId,
      userText: input.userText,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
      ...(input.systemText === undefined
        ? {}
        : { systemText: input.systemText }),
    };
    const completion = yield* model.completeChat(chatInput).pipe(
      Effect.catch((error) =>
        Effect.gen(function* onModelFail() {
          yield* journal
            .cancelTurn({
              conversationId: input.conversationId,
              ownerPrincipalId: input.ownerPrincipalId,
              purpose: input.purpose,
              turnId: input.turnId,
              worldRef,
            })
            .pipe(Effect.ignore);
          return yield* error;
        })
      )
    );

    if (signalAborted()) {
      yield* journal
        .cancelTurn({
          conversationId: input.conversationId,
          ownerPrincipalId: input.ownerPrincipalId,
          purpose: input.purpose,
          turnId: input.turnId,
          worldRef,
        })
        .pipe(Effect.ignore);
      return yield* new Unavailable({ code: "UNAVAILABLE" });
    }

    // Re-check journal phase — cancel may have won the race.
    const snapshot = yield* journal.recover({
      conversationId: input.conversationId,
      ownerPrincipalId: input.ownerPrincipalId,
      purpose: input.purpose,
      worldRef,
    });
    const current = snapshot.turns.find((t) => t.turnId === input.turnId);
    if (current === undefined) {
      return yield* new NotFoundOrDenied({ code: "NOT_FOUND_OR_DENIED" });
    }
    if (current.phase === "Cancelled") {
      return yield* new Conflict({ code: "CONFLICT" });
    }

    const evidenceLinks = [...(input.evidenceLinks ?? [])];
    // ZA-17 / F10: identifier-only links are not an authorized basis. Until
    // ZA-19 resolves + authorizes citations for this world/principal/claim,
    // settle Partial even when callers supply structurally valid links.
    const message = yield* journal.settleMessage({
      attemptId: input.attemptId,
      conversationId: input.conversationId,
      evidenceLinks,
      messageId: input.messageId,
      ownerPrincipalId: input.ownerPrincipalId,
      purpose: input.purpose,
      turnId: input.turnId,
      uncertainty: uncertaintyFromEvidenceBasis({
        citationsAuthorized: false,
        evidenceLinks,
        generatedText: completion.visibleText,
      }),
      visibleText: completion.visibleText,
      worldRef,
    });

    return {
      message,
      turn: { ...accepted, phase: "Settled" as const },
    };
  });
