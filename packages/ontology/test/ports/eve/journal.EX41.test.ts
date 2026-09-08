import { describe, expect, it } from "@effect/vitest";
import {
  AttemptId,
  ConversationId,
  IngressId,
  MessageId,
  RelationshipId,
  TurnId,
} from "@zoen/contracts/eve/values";
import { EvidenceRef } from "@zoen/contracts/worlds/values";
import { Effect, Schema } from "effect";

import {
  EveJournal,
  isAdmittedProvider,
  isLiveProviderBlocked,
} from "../../../src/ports/eve/journal.js";
import { PrincipalId } from "../../../src/ports/worlds/context.js";

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
const ownerPrincipalId = Schema.decodeSync(PrincipalId)(
  "00000000-0000-4000-8000-000000000210"
);
const attemptA = Schema.decodeSync(AttemptId)(
  "00000000-0000-4000-8000-000000000211"
);
const attemptB = Schema.decodeSync(AttemptId)(
  "00000000-0000-4000-8000-000000000212"
);
const purpose = "personal-records" as const;

const owner = {
  ownerPrincipalId,
  purpose,
  worldRef: null,
};

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
          ...owner,
          attemptId: attemptA,
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

  it.effect("blocks voice-blocked accept path", () =>
    Effect.gen(function* blocked() {
      const journal = yield* EveJournal;
      const voice = yield* Effect.exit(
        journal.acceptTurn({
          ...owner,
          attemptId: attemptB,
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
          ...owner,
          attemptId: attemptA,
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
          ...owner,
          attemptId: attemptA,
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
          ...owner,
          attemptId: attemptA,
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
        ...owner,
        attemptId: attemptB,
        conversationId,
        ingressId: ingressB,
        profileId: "eve-local-stub-v1",
        providerAdmission: "stub-local",
        relationshipId,
        turnId: turnB,
        userText: "cancele",
      });
      const cancelled = yield* journal.cancelTurn({
        ...owner,
        conversationId,
        turnId: turnB,
      });
      expect(cancelled.phase).toBe("Cancelled");

      const afterCancel = yield* Effect.exit(
        journal.settleMessage({
          ...owner,
          attemptId: attemptB,
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
          ...owner,
          attemptId: attemptA,
          conversationId,
          ingressId: ingressA,
          profileId: "eve-local-stub-v1",
          providerAdmission: "stub-local",
          relationshipId,
          turnId: turnA,
          userText: "fato 1",
        });
        yield* journal.settleMessage({
          ...owner,
          attemptId: attemptA,
          conversationId,
          evidenceLinks: [{ claimRef: null, evidenceRef }],
          messageId: messageA,
          turnId: turnA,
          uncertainty: "Known",
          visibleText: "Resposta grounded no evidenceRef.",
        });
        yield* journal.acceptTurn({
          ...owner,
          attemptId: attemptB,
          conversationId,
          ingressId: ingressB,
          profileId: "eve-local-stub-v1",
          providerAdmission: "stub-local",
          relationshipId,
          turnId: turnB,
          userText: "cancele",
        });
        yield* journal.cancelTurn({
          ...owner,
          conversationId,
          turnId: turnB,
        });

        const recovered = yield* journal.recover({
          ...owner,
          conversationId,
        });
        expect(recovered.authorityCredentialPresent).toBeFalsy();
        expect(recovered.providerAdmission).toBe("stub-local");
        expect(recovered.turns.map((turn) => turn.phase)).toStrictEqual([
          "Settled",
          "Cancelled",
        ]);
        expect(recovered.messages).toHaveLength(1);
        expect(recovered.messages[0]?.visibleText).toContain("grounded");
        expect(recovered.unresolvedAttempts).toHaveLength(0);
      }).pipe(Effect.provide(EveJournal.stubMemoryLayer))
  );

  it.effect("blockedProvidersLayer never fabricates journal success", () =>
    Effect.gen(function* blockedLayer() {
      const journal = yield* EveJournal;
      const exit = yield* Effect.exit(
        journal.acceptTurn({
          ...owner,
          attemptId: attemptA,
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

  it.effect("admits opencode-zen profile on the journal path", () =>
    Effect.gen(function* zen() {
      const journal = yield* EveJournal;
      const accepted = yield* journal.acceptTurn({
        ...owner,
        attemptId: attemptA,
        conversationId,
        ingressId: ingressA,
        profileId: "eve-opencode-zen-v1",
        providerAdmission: "opencode-zen",
        relationshipId,
        turnId: turnA,
        userText: "live path accept",
      });
      expect(accepted.phase).toBe("Accepted");
      const recovered = yield* journal.recover({
        ...owner,
        conversationId,
      });
      expect(recovered.providerAdmission).toBe("opencode-zen");
      expect(recovered.conversation.profileId).toBe("eve-opencode-zen-v1");
      expect(recovered.authorityCredentialPresent).toBeFalsy();
      expect(recovered.unresolvedAttempts).toHaveLength(1);
      const serialized = JSON.stringify(recovered);
      expect(serialized.includes("sk-")).toBeFalsy();
      expect(serialized.toLowerCase().includes("apikey")).toBeFalsy();
    }).pipe(Effect.provide(EveJournal.stubMemoryLayer))
  );

  it.effect("changed ingress text conflicts; other owner cannot recover", () =>
    Effect.gen(function* ownership() {
      const journal = yield* EveJournal;
      yield* journal.acceptTurn({
        ...owner,
        attemptId: attemptA,
        conversationId,
        ingressId: ingressA,
        profileId: "eve-local-stub-v1",
        providerAdmission: "stub-local",
        relationshipId,
        turnId: turnA,
        userText: "original",
      });
      const conflicted = yield* Effect.exit(
        journal.acceptTurn({
          ...owner,
          attemptId: attemptA,
          conversationId,
          ingressId: ingressA,
          profileId: "eve-local-stub-v1",
          providerAdmission: "stub-local",
          relationshipId,
          turnId: turnA,
          userText: "changed text",
        })
      );
      expect(conflicted._tag).toBe("Failure");
      const other = Schema.decodeSync(PrincipalId)(
        "00000000-0000-4000-8000-000000000299"
      );
      const denied = yield* Effect.exit(
        journal.recover({
          conversationId,
          ownerPrincipalId: other,
          purpose,
          worldRef: null,
        })
      );
      expect(denied._tag).toBe("Failure");
    }).pipe(Effect.provide(EveJournal.stubMemoryLayer))
  );
});
