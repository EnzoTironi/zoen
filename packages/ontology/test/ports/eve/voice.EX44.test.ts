/* oxlint-disable eslint/sort-keys -- ZA-18 owner/CAS field insertions */
import { describe, expect, it } from "@effect/vitest";
import {
  AttemptId,
  ConversationId,
  IngressId,
  MessageId,
  RelationshipId,
  TurnId,
} from "@zoen/contracts/eve/values";
import {
  probeWebSpeechCapabilities,
  voiceRecognitionReady,
  voiceSynthesisReady,
} from "@zoen/contracts/eve/web-speech";
import { Effect, Layer, Redacted, Schema } from "effect";

import { EveJournal } from "../../../src/ports/eve/journal.js";
import type { EveFetch } from "../../../src/ports/eve/opencode-zen.js";
import { EveOpenCodeZen } from "../../../src/ports/eve/opencode-zen.js";
import { runEveVoiceTurn } from "../../../src/ports/eve/voice.js";
import { PrincipalId } from "../../../src/ports/worlds/context.js";

const conversationId = Schema.decodeSync(ConversationId)(
  "00000000-0000-4000-8000-000000000501"
);
const relationshipId = Schema.decodeSync(RelationshipId)(
  "00000000-0000-4000-8000-000000000502"
);
const ingressId = Schema.decodeSync(IngressId)(
  "00000000-0000-4000-8000-000000000503"
);
const turnId = Schema.decodeSync(TurnId)(
  "00000000-0000-4000-8000-000000000504"
);
const messageId = Schema.decodeSync(MessageId)(
  "00000000-0000-4000-8000-000000000505"
);
const ownerPrincipalId = Schema.decodeSync(PrincipalId)(
  "00000000-0000-4000-8000-000000000610"
);
const attemptId = Schema.decodeSync(AttemptId)(
  "00000000-0000-4000-8000-000000000611"
);

const settings = {
  apiKey: Redacted.make("unit-test-key-must-not-journal"),
  baseUrl: "https://example.test/zen/v1",
  model: "big-pickle",
  userAgent: "opencode/1.17.20 zoen-eve",
} as const;

const mockOkFetch: EveFetch = () =>
  Promise.resolve(
    Response.json(
      {
        choices: [
          {
            message: {
              content: "Model reply: eve-ok from mocked OpenCode Zen.",
            },
          },
        ],
      },
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    )
  );

const zenLayer = Layer.mergeAll(
  EveJournal.stubMemoryLayer,
  EveOpenCodeZen.liveLayer(settings, mockOkFetch)
);

const MockSpeechRecognition = function MockSpeechRecognition() {
  /* ctor stand-in for capability probe */
};

const capable = probeWebSpeechCapabilities({
  SpeechRecognition: MockSpeechRecognition,
  speechSynthesis: { speak: () => null },
});

const recognitionOnly = probeWebSpeechCapabilities({
  webkitSpeechRecognition: MockSpeechRecognition,
});

const missing = probeWebSpeechCapabilities({});

describe("EX44 Eve web-speech voice profile", () => {
  it("probes Web Speech host capabilities without inventing cloud STT/TTS", () => {
    expect({
      capableRecognition: capable.recognitionAvailable,
      capableSynthesis: capable.synthesisAvailable,
      missingRecognition: missing.recognitionAvailable,
      missingSynthesis: missing.synthesisAvailable,
      profile: capable.profileId,
      readyIn: voiceRecognitionReady(capable),
      readyMissing: voiceRecognitionReady(missing),
      synthIn: voiceSynthesisReady(capable),
      synthRecognitionOnly: voiceSynthesisReady(recognitionOnly),
      webkitRecognition: recognitionOnly.recognitionAvailable,
    }).toStrictEqual({
      capableRecognition: true,
      capableSynthesis: true,
      missingRecognition: false,
      missingSynthesis: false,
      profile: "eve-web-speech-v1",
      readyIn: true,
      readyMissing: false,
      synthIn: true,
      synthRecognitionOnly: false,
      webkitRecognition: true,
    });
  });

  it.effect(
    "transcript → Zen text settle returns speakText; INV-01 holds",
    () =>
      Effect.gen(function* path() {
        const result = yield* runEveVoiceTurn({
          capabilities: capable,
          conversationId,
          attemptId,
          ownerPrincipalId,
          purpose: "personal-records",
          ingressId,
          messageId,
          relationshipId,
          transcript: "quanto gastei este mês?",
          turnId,
        });
        const journal = yield* EveJournal;
        const snapshot = yield* journal.recover({
          conversationId,
          ownerPrincipalId,
          purpose: "personal-records",
          worldRef: null,
        });
        const wire = JSON.stringify(snapshot);
        expect({
          admission: snapshot.providerAdmission,
          credential: snapshot.authorityCredentialPresent,
          phase: result.turn.phase,
          profile: snapshot.conversation.profileId,
          speakHasEveOk: result.speakText.includes("eve-ok"),
          synthesisReady: result.synthesisReady,
          wireHasKey: wire.includes("unit-test-key"),
        }).toStrictEqual({
          admission: "web-speech",
          credential: false,
          phase: "Settled",
          profile: "eve-web-speech-v1",
          speakHasEveOk: true,
          synthesisReady: true,
          wireHasKey: false,
        });
      }).pipe(Effect.provide(zenLayer))
  );

  it.effect("fail-closed when SpeechRecognition is unavailable", () =>
    Effect.gen(function* blocked() {
      const exit = yield* Effect.exit(
        runEveVoiceTurn({
          capabilities: missing,
          conversationId,
          attemptId,
          ownerPrincipalId,
          purpose: "personal-records",
          ingressId,
          messageId,
          relationshipId,
          transcript: "hello",
          turnId,
        })
      );
      expect(exit._tag).toBe("Failure");
    }).pipe(Effect.provide(zenLayer))
  );

  it.effect("fail-closed on empty transcript", () =>
    Effect.gen(function* empty() {
      const exit = yield* Effect.exit(
        runEveVoiceTurn({
          capabilities: capable,
          conversationId,
          attemptId,
          ownerPrincipalId,
          purpose: "personal-records",
          ingressId,
          messageId,
          relationshipId,
          transcript: "   ",
          turnId,
        })
      );
      expect(exit._tag).toBe("Failure");
    }).pipe(Effect.provide(zenLayer))
  );
});
