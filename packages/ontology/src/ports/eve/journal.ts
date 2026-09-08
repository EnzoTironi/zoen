import type {
  AttemptId,
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
import {
  Blocked,
  Conflict,
  NotFoundOrDenied,
} from "@zoen/contracts/worlds/errors";
import type { Unavailable } from "@zoen/contracts/worlds/errors";
import type { WorldRef } from "@zoen/contracts/worlds/values";
// oxlint-disable-next-line typescript/consistent-type-imports -- Schema value for typeof Purpose.Type
import { Purpose } from "@zoen/contracts/worlds/values";
import { Context, Effect, Layer, Ref } from "effect";
import type { Effect as EffectType } from "effect";

// oxlint-disable-next-line typescript/consistent-type-imports -- Schema value for typeof PrincipalId.Type
import { PrincipalId } from "../worlds/context.js";

/**
 * Operational interaction journal (architecture + INV-01).
 * Owns conversation/turn/message recoverability — never domain authority credentials
 * and never OpenCode / authority API keys (INV-01).
 *
 * Product composition installs the durable Postgres adapter from apps/server
 * (ZA-18). `stubMemoryLayer` remains an offline unit-proof only — not ownership
 * or crash-recovery qualification. `blockedProvidersLayer` stays the fail-closed
 * default until a restricted journal identity is wired.
 */
export interface JournalOwnerScope {
  readonly ownerPrincipalId: typeof PrincipalId.Type;
  readonly purpose: typeof Purpose.Type;
}

export interface AcceptTurnInput extends JournalOwnerScope {
  readonly attemptId: AttemptId;
  readonly conversationId: ConversationId;
  readonly ingressId: IngressId;
  readonly profileId: EveProfileId;
  readonly providerAdmission: EveProviderAdmission;
  readonly relationshipId: RelationshipId;
  readonly turnId: TurnId;
  readonly userText: string;
  readonly worldRef: WorldRef | null;
}

export interface SettleMessageInput extends JournalOwnerScope {
  readonly attemptId: AttemptId;
  readonly conversationId: ConversationId;
  readonly evidenceLinks: readonly EveEvidenceLink[];
  readonly messageId: MessageId;
  readonly turnId: TurnId;
  readonly uncertainty: UncertaintyKind;
  readonly visibleText: string;
  readonly worldRef: WorldRef | null;
}

export interface CancelTurnInput extends JournalOwnerScope {
  readonly conversationId: ConversationId;
  readonly turnId: TurnId;
  readonly worldRef: WorldRef | null;
}

export interface RecoverJournalInput extends JournalOwnerScope {
  readonly conversationId: ConversationId;
  readonly worldRef: WorldRef | null;
}

type JournalFailure = Blocked | Conflict | NotFoundOrDenied | Unavailable;

interface MutableConversation {
  conversation: EveConversation;
  readonly ingressIndex: Map<string, { intentKey: string; turnId: TurnId }>;
  messages: EveVisibleMessage[];
  readonly ownerPrincipalId: typeof PrincipalId.Type;
  readonly providerAdmission: EveProviderAdmission;
  readonly purpose: typeof Purpose.Type;
  turns: EveTurn[];
  readonly unresolvedAttempts: Map<
    string,
    { attemptId: AttemptId; turnId: TurnId }
  >;
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
export const isAdmittedProvider = (admission: EveProviderAdmission): boolean =>
  admission === "opencode-zen" ||
  admission === "web-speech" ||
  admission === "stub-local";

const profileMatchesAdmission = (
  profileId: EveProfileId,
  admission: EveProviderAdmission
): boolean => {
  if (admission === "opencode-zen") {
    return profileId === "eve-opencode-zen-v1";
  }
  if (admission === "web-speech") {
    return profileId === "eve-web-speech-v1";
  }
  if (admission === "stub-local") {
    return profileId === "eve-local-stub-v1";
  }
  return false;
};

/** Unit-proof intent key (durable adapter uses sha256); never logged as credentials. */
export const stubIntentKey = (input: {
  readonly conversationId: ConversationId;
  readonly ingressId: IngressId;
  readonly profileId: EveProfileId;
  readonly providerAdmission: EveProviderAdmission;
  readonly purpose: typeof Purpose.Type;
  readonly relationshipId: RelationshipId;
  readonly turnId: TurnId;
  readonly userText: string;
  readonly worldRef: WorldRef | null;
}): string =>
  [
    input.conversationId,
    input.ingressId,
    input.turnId,
    input.relationshipId,
    input.purpose,
    input.profileId,
    input.providerAdmission,
    input.userText,
    input.worldRef === null
      ? ""
      : `${input.worldRef.realm}:${input.worldRef.worldId}`,
  ].join("\u0000");

const worldMatches = (
  stored: WorldRef | null,
  requested: WorldRef | null
): boolean => {
  if (stored === null && requested === null) {
    return true;
  }
  if (stored === null || requested === null) {
    return false;
  }
  return (
    stored.realm === requested.realm && stored.worldId === requested.worldId
  );
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
      input: RecoverJournalInput
    ) => EffectType.Effect<EveJournalSnapshot, JournalFailure>;
    readonly settleMessage: (
      input: SettleMessageInput
    ) => EffectType.Effect<EveVisibleMessage, JournalFailure>;
  }
>()("zoen/ontology/ports/eve/EveJournal") {
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
   * In-memory journal for offline unit proofs only.
   * Enforces actor/purpose/world binding for ZA-18 handler contracts, but does
   * not persist PG/S3 and must not be installed as the product Eve surface.
   */
  static readonly stubMemoryLayer = Layer.effect(
    EveJournal,
    Effect.gen(function* memory() {
      const store = yield* Ref.make(new Map<string, MutableConversation>());

      const getOwned = (input: {
        readonly conversationId: ConversationId;
        readonly ownerPrincipalId: typeof PrincipalId.Type;
        readonly purpose: typeof Purpose.Type;
        readonly worldRef: WorldRef | null;
      }) =>
        Effect.gen(function* lookup() {
          const current = yield* Ref.get(store);
          const row = current.get(input.conversationId);
          if (row === undefined) {
            return yield* notFound;
          }
          if (
            row.ownerPrincipalId !== input.ownerPrincipalId ||
            row.purpose !== input.purpose ||
            !worldMatches(row.conversation.worldRef, input.worldRef)
          ) {
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
              !profileMatchesAdmission(input.profileId, input.providerAdmission)
            ) {
              return yield* blockedProfile;
            }

            const intentKey = stubIntentKey(input);
            const turn: EveTurn = {
              conversationId: input.conversationId,
              ingressId: input.ingressId,
              phase: "Accepted",
              turnId: input.turnId,
              version: "1",
            };

            type AcceptOutcome =
              | { readonly _tag: "notFound" }
              | { readonly _tag: "conflict" }
              | { readonly _tag: "replay"; readonly turn: EveTurn }
              | { readonly _tag: "accepted"; readonly turn: EveTurn };

            const currentMap = yield* Ref.get(store);
            let outcome: AcceptOutcome;
            const next = new Map(currentMap);
            const existing = next.get(input.conversationId);
            // oxlint-disable-next-line no-negated-condition, unicorn/no-negated-condition
            if (existing !== undefined) {
              if (
                existing.ownerPrincipalId !== input.ownerPrincipalId ||
                existing.purpose !== input.purpose ||
                !worldMatches(existing.conversation.worldRef, input.worldRef) ||
                existing.conversation.relationshipId !== input.relationshipId
              ) {
                outcome = { _tag: "notFound" };
              } else {
                const prior = existing.ingressIndex.get(input.ingressId);
                // oxlint-disable-next-line no-negated-condition, unicorn/no-negated-condition
                if (prior !== undefined) {
                  if (prior.intentKey === intentKey) {
                    const replayed = existing.turns.find(
                      (candidate) => candidate.turnId === prior.turnId
                    );
                    outcome =
                      replayed === undefined
                        ? { _tag: "conflict" }
                        : { _tag: "replay", turn: replayed };
                  } else {
                    outcome = { _tag: "conflict" };
                  }
                } else {
                  existing.turns.push(turn);
                  existing.ingressIndex.set(input.ingressId, {
                    intentKey,
                    turnId: input.turnId,
                  });
                  existing.unresolvedAttempts.set(input.turnId, {
                    attemptId: input.attemptId,
                    turnId: input.turnId,
                  });
                  existing.conversation = {
                    ...existing.conversation,
                    revision: String(
                      Number(existing.conversation.revision) + 1
                    ),
                  };
                  outcome = { _tag: "accepted", turn };
                }
              }
            } else {
              next.set(input.conversationId, {
                conversation: {
                  conversationId: input.conversationId,
                  profileId: input.profileId,
                  relationshipId: input.relationshipId,
                  revision: "1",
                  schemaVersion: "eve.v1",
                  worldRef: input.worldRef,
                },
                ingressIndex: new Map([
                  [input.ingressId, { intentKey, turnId: input.turnId }],
                ]),
                messages: [],
                ownerPrincipalId: input.ownerPrincipalId,
                providerAdmission: input.providerAdmission,
                purpose: input.purpose,
                turns: [turn],
                unresolvedAttempts: new Map([
                  [
                    input.turnId,
                    { attemptId: input.attemptId, turnId: input.turnId },
                  ],
                ]),
              });
              outcome = { _tag: "accepted", turn };
            }
            if (outcome._tag === "accepted") {
              yield* Ref.set(store, next);
            }

            if (outcome._tag === "notFound") {
              return yield* notFound;
            }
            if (outcome._tag === "conflict") {
              return yield* conflict;
            }
            return outcome.turn;
          }),

        cancelTurn: (input) =>
          Effect.gen(function* cancel() {
            const owned = yield* getOwned({
              conversationId: input.conversationId,
              ownerPrincipalId: input.ownerPrincipalId,
              purpose: input.purpose,
              worldRef: input.worldRef,
            });
            const turn = owned.turns.find(
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
              mutable.unresolvedAttempts.delete(input.turnId);
              return next;
            });
            return cancelled;
          }),

        recover: (input) =>
          Effect.gen(function* recover() {
            const row = yield* getOwned(input);
            const snapshot: EveJournalSnapshot = {
              authorityCredentialPresent: false,
              conversation: row.conversation,
              messages: [...row.messages],
              providerAdmission: row.providerAdmission,
              turns: [...row.turns],
              unresolvedAttempts: [...row.unresolvedAttempts.values()].map(
                (attempt) => ({
                  attemptId: attempt.attemptId,
                  state: "unresolved" as const,
                  turnId: attempt.turnId,
                })
              ),
            };
            return snapshot;
          }),

        settleMessage: (input) =>
          Effect.gen(function* settle() {
            const row = yield* getOwned({
              conversationId: input.conversationId,
              ownerPrincipalId: input.ownerPrincipalId,
              purpose: input.purpose,
              worldRef: input.worldRef,
            });
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
            if (turn.phase === "Settled") {
              const prior = row.messages.find(
                (message) => message.turnId === input.turnId
              );
              if (prior === undefined) {
                return yield* conflict;
              }
              const held = row.unresolvedAttempts.get(input.turnId);
              if (held !== undefined && held.attemptId !== input.attemptId) {
                return yield* conflict;
              }
              return prior;
            }
            const held = row.unresolvedAttempts.get(input.turnId);
            if (held === undefined || held.attemptId !== input.attemptId) {
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
            yield* Ref.update(store, (map) => {
              const next = new Map(map);
              const mutable = next.get(input.conversationId);
              if (mutable === undefined) {
                return next;
              }
              mutable.turns = mutable.turns.map((candidate) =>
                candidate.turnId === input.turnId ? settledTurn : candidate
              );
              mutable.messages.push(message);
              mutable.unresolvedAttempts.delete(input.turnId);
              return next;
            });
            return message;
          }),
      });
    })
  );
}
