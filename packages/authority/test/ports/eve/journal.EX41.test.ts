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
  isAdmittedProvider,
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
  it("marks real-model and voice-blocked as live-blocked; Zen/stub/web-speech admitted", () => {
    expect({
      admittedSpeech: isAdmittedProvider("web-speech"),
      admittedStub: isAdmittedProvider("stub-local"),
      admittedVoiceBlocked: isAdmittedProvider("voice-blocked"),
      admittedZen: isAdmittedProvider("opencode-zen"),
      liveReal: isLiveProviderBlocked("real-model-blocked"),
      liveSpeech: isLiveProviderBlocked("web-speech"),
      liveStub: isLiveProviderBlocked("stub-local"),
      liveVoiceBlocked: isLiveProviderBlocked("voice-blocked"),
      liveZen: isLiveProviderBlocked("opencode-zen"),
    }).toStrictEqual({
      admittedSpeech: true,
      admittedStub: true,
      admittedVoiceBlocked: false,
      admittedZen: true,
      liveReal: true,
      liveSpeech: false,
      liveStub: false,
      liveVoiceBlocked: true,
      liveZen: false,
    });
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
          worldRef: null,
        })
      );
      expect(real._tag).toBe("Failure");
    }).pipe(Effect.provide(EveJournal.stubMemoryLayer))
  );

  it.effect("blocks voice-blocked accept path", () =>
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
          worldRef: null,
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
          worldRef: null,
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
          worldRef: null,
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
        worldRef: null,
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
          worldRef: null,
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
          worldRef: null,
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
          worldRef: null,
        })
      );
      expect(exit._tag).toBe("Failure");
    }).pipe(Effect.provide(EveJournal.blockedProvidersLayer))
  );

  it.effect("admits opencode-zen profile on the journal path", () =>
    Effect.gen(function* zen() {
      const journal = yield* EveJournal;
      const accepted = yield* journal.acceptTurn({
        conversationId,
        ingressId: ingressA,
        profileId: "eve-opencode-zen-v1",
        providerAdmission: "opencode-zen",
        relationshipId,
        turnId: turnA,
        userText: "live path accept",
        worldRef: null,
      });
      expect(accepted.phase).toBe("Accepted");
      const recovered = yield* journal.recover(conversationId);
      expect(recovered.providerAdmission).toBe("opencode-zen");
      expect(recovered.conversation.profileId).toBe("eve-opencode-zen-v1");
      expect(recovered.authorityCredentialPresent).toBeFalsy();
      const serialized = JSON.stringify(recovered);
      expect(serialized.includes("sk-")).toBeFalsy();
      expect(serialized.toLowerCase().includes("apikey")).toBeFalsy();
    }).pipe(Effect.provide(EveJournal.stubMemoryLayer))
  );
});
