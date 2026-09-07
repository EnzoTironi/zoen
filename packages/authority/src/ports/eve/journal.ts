import {
  Blocked,
  Conflict,
  NotFoundOrDenied,
} from "@zoen/contracts/d01/errors";
import type {
  ConversationId,
  EveConversation,
  EveEvidenceLink,
  EveJournalSnapshot,
  EveProfileId,
  EveProviderAdmission,
  EveTurn,
  EveVisibleMessage,
  IngressId,
  MessageId,
  RelationshipId,
  TurnId,
  UncertaintyKind,
} from "@zoen/contracts/eve/values";
import { Context, Effect, Layer, Ref } from "effect";
import type { Effect as EffectType } from "effect";

/**
 * Operational interaction journal (architecture + INV-01).
 * Owns conversation/turn/message recoverability — never domain authority credentials
 * and never OpenCode / authority API keys (INV-01).
 *
 * EX41: in-memory disposable layer proves recoverability.
 * EX42+: admits `opencode-zen` / `eve-opencode-zen-v1` as the product path.
 * Voice and unqualified real-model admissions stay fail-closed Blocked (F05/F06).
 */
export interface AcceptTurnInput {
  readonly conversationId: ConversationId;
  readonly ingressId: IngressId;
  readonly profileId: EveProfileId;
  readonly providerAdmission: EveProviderAdmission;
  readonly relationshipId: RelationshipId;
  readonly turnId: TurnId;
  readonly userText: string;
}

export interface SettleMessageInput {
  readonly conversationId: ConversationId;
  readonly evidenceLinks: readonly EveEvidenceLink[];
  readonly messageId: MessageId;
  readonly turnId: TurnId;
  readonly uncertainty: UncertaintyKind;
  readonly visibleText: string;
}

export interface CancelTurnInput {
  readonly conversationId: ConversationId;
  readonly turnId: TurnId;
}

type JournalFailure = Blocked | Conflict | NotFoundOrDenied;

interface MutableConversation {
  conversation: EveConversation;
  readonly ingressIndex: Map<string, TurnId>;
  messages: EveVisibleMessage[];
  readonly providerAdmission: EveProviderAdmission;
  turns: EveTurn[];
}

const blockedProfile = new Blocked({ code: "PROFILE_BLOCKED" });
const notFound = new NotFoundOrDenied({ code: "NOT_FOUND_OR_DENIED" });
const conflict = new Conflict({ code: "CONFLICT" });

/** True when admission forbids inference in this increment. */
export const isLiveProviderBlocked = (
  admission: EveProviderAdmission
): boolean =>
  admission === "real-model-blocked" || admission === "voice-blocked";

/** Admitted product / proof admissions that may mutate the journal. */
export const isAdmittedProvider = (
  admission: EveProviderAdmission
): boolean => admission === "opencode-zen" || admission === "stub-local";

const profileMatchesAdmission = (
  profileId: EveProfileId,
  admission: EveProviderAdmission
): boolean => {
  if (admission === "opencode-zen") {
    return profileId === "eve-opencode-zen-v1";
  }
  if (admission === "stub-local") {
    return profileId === "eve-local-stub-v1";
  }
  return false;
};

export class EveJournal extends Context.Service<
  EveJournal,
  {
    readonly acceptTurn: (
      input: AcceptTurnInput
    ) => EffectType.Effect<EveTurn, JournalFailure>;
    readonly cancelTurn: (
      input: CancelTurnInput
    ) => EffectType.Effect<EveTurn, JournalFailure>;
    readonly recover: (
      conversationId: ConversationId
    ) => EffectType.Effect<EveJournalSnapshot, JournalFailure>;
    readonly settleMessage: (
      input: SettleMessageInput
    ) => EffectType.Effect<EveVisibleMessage, JournalFailure>;
  }
>()("zoen/authority/ports/eve/EveJournal") {
  /** Fail-closed: no fake model / voice path. */
  static readonly blockedProvidersLayer = Layer.succeed(
    EveJournal,
    EveJournal.of({
      acceptTurn: () => Effect.fail(blockedProfile),
      cancelTurn: () => Effect.fail(blockedProfile),
      recover: () => Effect.fail(blockedProfile),
      settleMessage: () => Effect.fail(blockedProfile),
    })
  );

  /**
   * In-memory journal for local proofs and live OpenCode Zen turn path.
   * Does not persist PG/S3; does not embed API keys in snapshots.
   */
  static readonly stubMemoryLayer = Layer.effect(
    EveJournal,
    Effect.gen(function* memory() {
      const store = yield* Ref.make(new Map<string, MutableConversation>());

      const getOrFail = (conversationId: ConversationId) =>
        Effect.gen(function* lookup() {
          const current = yield* Ref.get(store);
          const row = current.get(conversationId);
          if (row === undefined) {
            return yield* notFound;
          }
          return row;
        });

      return EveJournal.of({
        acceptTurn: (input) =>
          Effect.gen(function* accept() {
            if (isLiveProviderBlocked(input.providerAdmission)) {
              return yield* blockedProfile;
            }
            if (!isAdmittedProvider(input.providerAdmission)) {
              return yield* blockedProfile;
            }
            if (
              !profileMatchesAdmission(
                input.profileId,
                input.providerAdmission
              )
            ) {
              return yield* blockedProfile;
            }

            const turn: EveTurn = {
              conversationId: input.conversationId,
              ingressId: input.ingressId,
              phase: "Accepted",
              turnId: input.turnId,
              version: "1",
            };

            yield* Ref.update(store, (current) => {
              const next = new Map(current);
              const existing = next.get(input.conversationId);
              if (existing !== undefined) {
                if (existing.ingressIndex.has(input.ingressId)) {
                  return next;
                }
                existing.turns.push(turn);
                existing.ingressIndex.set(input.ingressId, input.turnId);
                existing.conversation = {
                  ...existing.conversation,
                  revision: String(Number(existing.conversation.revision) + 1),
                };
                return next;
              }
              next.set(input.conversationId, {
                conversation: {
                  conversationId: input.conversationId,
                  profileId: input.profileId,
                  relationshipId: input.relationshipId,
                  revision: "1",
                  schemaVersion: "eve.v1",
                  worldRef: null,
                },
                ingressIndex: new Map([[input.ingressId, input.turnId]]),
                messages: [],
                providerAdmission: input.providerAdmission,
                turns: [turn],
              });
              return next;
            });

            const row = yield* getOrFail(input.conversationId);
            const replayed = row.turns.find(
              (candidate) => candidate.ingressId === input.ingressId
            );
            if (replayed === undefined) {
              return yield* conflict;
            }
            return replayed;
          }),

        cancelTurn: (input) =>
          Effect.gen(function* cancel() {
            const row = yield* getOrFail(input.conversationId);
            const turn = row.turns.find(
              (candidate) => candidate.turnId === input.turnId
            );
            if (turn === undefined) {
              return yield* notFound;
            }
            if (turn.phase === "Settled") {
              return yield* conflict;
            }
            const cancelled: EveTurn = { ...turn, phase: "Cancelled" };
            yield* Ref.update(store, (current) => {
              const next = new Map(current);
              const mutable = next.get(input.conversationId);
              if (mutable === undefined) {
                return next;
              }
              mutable.turns = mutable.turns.map((candidate) =>
                candidate.turnId === input.turnId ? cancelled : candidate
              );
              return next;
            });
            return cancelled;
          }),

        recover: (conversationId) =>
          Effect.gen(function* recover() {
            const row = yield* getOrFail(conversationId);
            const snapshot: EveJournalSnapshot = {
              authorityCredentialPresent: false,
              conversation: row.conversation,
              messages: [...row.messages],
              providerAdmission: row.providerAdmission,
              turns: [...row.turns],
            };
            return snapshot;
          }),

        settleMessage: (input) =>
          Effect.gen(function* settle() {
            const row = yield* getOrFail(input.conversationId);
            if (!isAdmittedProvider(row.providerAdmission)) {
              return yield* blockedProfile;
            }
            const turn = row.turns.find(
              (candidate) => candidate.turnId === input.turnId
            );
            if (turn === undefined) {
              return yield* notFound;
            }
            if (turn.phase === "Cancelled") {
              return yield* conflict;
            }
            const message: EveVisibleMessage = {
              evidenceLinks: [...input.evidenceLinks],
              messageId: input.messageId,
              state: "Visible",
              turnId: input.turnId,
              uncertainty: input.uncertainty,
              visibleText: input.visibleText,
            };
            const settledTurn: EveTurn = { ...turn, phase: "Settled" };
            yield* Ref.update(store, (current) => {
              const next = new Map(current);
              const mutable = next.get(input.conversationId);
              if (mutable === undefined) {
                return next;
              }
              mutable.turns = mutable.turns.map((candidate) =>
                candidate.turnId === input.turnId ? settledTurn : candidate
              );
              mutable.messages.push(message);
              return next;
            });
            return message;
          }),
      });
    })
  );
}
