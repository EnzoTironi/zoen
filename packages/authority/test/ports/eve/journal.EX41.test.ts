import { describe, expect, it } from "@effect/vitest";
import { EvidenceRef } from "@zoen/contracts/d01/values";
import {
  ConversationId,
  IngressId,
  MessageId,
  RelationshipId,
  TurnId,
} from "@zoen/contracts/eve/values";
import { Effect, Schema } from "effect";

import {
  EveJournal,
  isLiveProviderBlocked,
} from "../../../src/ports/eve/journal.js";

const conversationId = Schema.decodeSync(ConversationId)(
  "00000000-0000-4000-8000-000000000201"
);
const relationshipId = Schema.decodeSync(RelationshipId)(
  "00000000-0000-4000-8000-000000000202"
);
const ingressA = Schema.decodeSync(IngressId)(
  "00000000-0000-4000-8000-000000000203"
);
const ingressB = Schema.decodeSync(IngressId)(
  "00000000-0000-4000-8000-000000000204"
);
const turnA = Schema.decodeSync(TurnId)("00000000-0000-4000-8000-000000000205");
const turnB = Schema.decodeSync(TurnId)("00000000-0000-4000-8000-000000000206");
const messageA = Schema.decodeSync(MessageId)(
  "00000000-0000-4000-8000-000000000207"
);
const evidenceRef = Schema.decodeSync(EvidenceRef)(
  "00000000-0000-4000-8000-000000000208"
);

describe("EX41 eve journal stub port", () => {
  it("marks real-model and voice admissions as live-blocked", () => {
    expect(isLiveProviderBlocked("stub-local")).toBeFalsy();
    expect(isLiveProviderBlocked("real-model-blocked")).toBeTruthy();
    expect(isLiveProviderBlocked("voice-blocked")).toBeTruthy();
  });

  it.effect("blocks real-model accept path", () =>
    Effect.gen(function* blocked() {
      const journal = yield* EveJournal;
      const real = yield* Effect.exit(
        journal.acceptTurn({
          conversationId,
          ingressId: ingressA,
          profileId: "eve-local-stub-v1",
          providerAdmission: "real-model-blocked",
          relationshipId,
          turnId: turnA,
          userText: "hello",
        })
      );
      expect(real._tag).toBe("Failure");
    }).pipe(Effect.provide(EveJournal.stubMemoryLayer))
  );

  it.effect("blocks voice accept path", () =>
    Effect.gen(function* blocked() {
      const journal = yield* EveJournal;
      const voice = yield* Effect.exit(
        journal.acceptTurn({
          conversationId,
          ingressId: ingressB,
          profileId: "eve-local-stub-v1",
          providerAdmission: "voice-blocked",
          relationshipId,
          turnId: turnB,
          userText: "hello",
        })
      );
      expect(voice._tag).toBe("Failure");
    }).pipe(Effect.provide(EveJournal.stubMemoryLayer))
  );

  it.effect(
    "accepts turns idempotently on ingress and settles grounded text",
    () =>
      Effect.gen(function* proof() {
        const journal = yield* EveJournal;
        const first = yield* journal.acceptTurn({
          conversationId,
          ingressId: ingressA,
          profileId: "eve-local-stub-v1",
          providerAdmission: "stub-local",
          relationshipId,
          turnId: turnA,
          userText: "fato 1",
        });
        expect(first.phase).toBe("Accepted");

        const replay = yield* journal.acceptTurn({
          conversationId,
          ingressId: ingressA,
          profileId: "eve-local-stub-v1",
          providerAdmission: "stub-local",
          relationshipId,
          turnId: turnA,
          userText: "fato 1",
        });
        expect(replay.turnId).toBe(turnA);

        const settled = yield* journal.settleMessage({
          conversationId,
          evidenceLinks: [{ claimRef: null, evidenceRef }],
          messageId: messageA,
          turnId: turnA,
          uncertainty: "Known",
          visibleText: "Resposta grounded no evidenceRef.",
        });
        expect(settled.state).toBe("Visible");
        expect(settled.uncertainty).toBe("Known");
      }).pipe(Effect.provide(EveJournal.stubMemoryLayer))
  );

  it.effect("cancels a pending turn and rejects settle after cancel", () =>
    Effect.gen(function* proof() {
      const journal = yield* EveJournal;
      yield* journal.acceptTurn({
        conversationId,
        ingressId: ingressB,
        profileId: "eve-local-stub-v1",
        providerAdmission: "stub-local",
        relationshipId,
        turnId: turnB,
        userText: "cancele",
      });
      const cancelled = yield* journal.cancelTurn({
        conversationId,
        turnId: turnB,
      });
      expect(cancelled.phase).toBe("Cancelled");

      const afterCancel = yield* Effect.exit(
        journal.settleMessage({
          conversationId,
          evidenceLinks: [],
          messageId: messageA,
          turnId: turnB,
          uncertainty: "Unknown",
          visibleText: "não deveria settle",
        })
      );
      expect(afterCancel._tag).toBe("Failure");
    }).pipe(Effect.provide(EveJournal.stubMemoryLayer))
  );

  it.effect(
    "recovers journal order without a live model or authority credentials",
    () =>
      Effect.gen(function* proof() {
        const journal = yield* EveJournal;
        yield* journal.acceptTurn({
          conversationId,
          ingressId: ingressA,
          profileId: "eve-local-stub-v1",
          providerAdmission: "stub-local",
          relationshipId,
          turnId: turnA,
          userText: "fato 1",
        });
        yield* journal.settleMessage({
          conversationId,
          evidenceLinks: [{ claimRef: null, evidenceRef }],
          messageId: messageA,
          turnId: turnA,
          uncertainty: "Known",
          visibleText: "Resposta grounded no evidenceRef.",
        });
        yield* journal.acceptTurn({
          conversationId,
          ingressId: ingressB,
          profileId: "eve-local-stub-v1",
          providerAdmission: "stub-local",
          relationshipId,
          turnId: turnB,
          userText: "cancele",
        });
        yield* journal.cancelTurn({ conversationId, turnId: turnB });

        const recovered = yield* journal.recover(conversationId);
        expect(recovered.authorityCredentialPresent).toBeFalsy();
        expect(recovered.providerAdmission).toBe("stub-local");
        expect(recovered.turns.map((turn) => turn.phase)).toStrictEqual([
          "Settled",
          "Cancelled",
        ]);
        expect(recovered.messages).toHaveLength(1);
        expect(recovered.messages[0]?.visibleText).toContain("grounded");
      }).pipe(Effect.provide(EveJournal.stubMemoryLayer))
  );

  it.effect("blockedProvidersLayer never fabricates journal success", () =>
    Effect.gen(function* blockedLayer() {
      const journal = yield* EveJournal;
      const exit = yield* Effect.exit(
        journal.acceptTurn({
          conversationId,
          ingressId: ingressA,
          profileId: "eve-local-stub-v1",
          providerAdmission: "stub-local",
          relationshipId,
          turnId: turnA,
          userText: "nope",
        })
      );
      expect(exit._tag).toBe("Failure");
    }).pipe(Effect.provide(EveJournal.blockedProvidersLayer))
  );
});
