import { describe, expect, it } from "@effect/vitest";
import { browserVoiceTextTurnBinding } from "@zoen/contracts/eve/browser-voice";
import type { EveWebSpeechCapabilities } from "@zoen/contracts/eve/values";
import { WorldRef } from "@zoen/contracts/worlds/values";
import { Effect, Schema } from "effect";

import {
  buildVoiceTextTurnRequest,
  createBrowserVoiceSession,
} from "../../../src/features/eve/voice-pipeline.ts";
import { createVoiceSession } from "../../../src/features/eve/voice-session.ts";
import { EveWebSpeechError } from "../../../src/features/eve/web-speech.ts";

const capable: EveWebSpeechCapabilities = {
  admission: "web-speech",
  profileId: "eve-web-speech-v1",
  recognitionAvailable: true,
  synthesisAvailable: true,
};

const missing: EveWebSpeechCapabilities = {
  admission: "web-speech",
  profileId: "eve-web-speech-v1",
  recognitionAvailable: false,
  synthesisAvailable: false,
};

const worldRef = Schema.decodeSync(WorldRef)({
  realm: "live",
  worldId: "00000000-0000-4000-8000-000000000701",
});

const turnIds = {
  conversationId: "00000000-0000-4000-8000-000000000711",
  ingressId: "00000000-0000-4000-8000-000000000712",
  messageId: "00000000-0000-4000-8000-000000000713",
  relationshipId: "00000000-0000-4000-8000-000000000714",
  turnId: "00000000-0000-4000-8000-000000000715",
} as const;

const controlEnabled = (
  controls: ReturnType<
    ReturnType<typeof createVoiceSession>["snapshot"]
  >["controls"],
  id: string
): boolean => controls.find((row) => row.id === id)?.enabled === true;

describe("ZA-21 browser voice session adapter", () => {
  it("ZA-21-01a: explicit start yields reviewable transcript and visible controls", async () => {
    const session = createVoiceSession({
      listenOnce: ({ signal }) => {
        expect(signal.aborted).toBeFalsy();
        return Promise.resolve("quanto gastei este mês?");
      },
      readCapabilities: () => capable,
      speakText: () => Promise.resolve(),
      submitTextTurn: () =>
        Promise.resolve({ phase: "Settled", visibleText: "unused" }),
    });

    expect({
      binding: session.binding(),
      hidden: session.snapshot().hiddenListenerActive,
      phase: session.snapshot().phase,
      startEnabled: controlEnabled(session.snapshot().controls, "start-speech"),
    }).toStrictEqual({
      binding: browserVoiceTextTurnBinding(),
      hidden: false,
      phase: "idle",
      startEnabled: true,
    });

    const afterListen = await session.startSpeech();
    expect({
      confirm: controlEnabled(afterListen.controls, "confirm-transcript"),
      edit: controlEnabled(afterListen.controls, "edit-transcript"),
      hidden: afterListen.hiddenListenerActive,
      listening: afterListen.listening,
      phase: afterListen.phase,
      transcript: afterListen.transcript,
    }).toStrictEqual({
      confirm: true,
      edit: true,
      hidden: false,
      listening: false,
      phase: "reviewing",
      transcript: "quanto gastei este mês?",
    });
  });

  it("ZA-21-01b: corrected transcript submits text turn then speaks settled reply", async () => {
    const spoken: string[] = [];
    const submitted: string[] = [];

    const session = createVoiceSession({
      listenOnce: () => Promise.resolve("quanto gastei este mês?"),
      readCapabilities: () => capable,
      speakText: (text, { signal }) => {
        expect(signal.aborted).toBeFalsy();
        spoken.push(text);
        return Promise.resolve();
      },
      submitTextTurn: ({ userText, signal }) => {
        expect(signal.aborted).toBeFalsy();
        submitted.push(userText);
        return Promise.resolve({
          phase: "Settled",
          visibleText: "Você gastou R$ 42 este mês.",
        });
      },
    });

    await session.startSpeech();
    session.setTranscript("quanto gastei em setembro?");
    const afterConfirm = await session.confirmTranscript();

    expect({
      hidden: afterConfirm.hiddenListenerActive,
      phase: afterConfirm.phase,
      settled: afterConfirm.settledSpeakText,
      spoken,
      submitted,
    }).toStrictEqual({
      hidden: false,
      phase: "idle",
      settled: "Você gastou R$ 42 este mês.",
      spoken: ["Você gastou R$ 42 este mês."],
      submitted: ["quanto gastei em setembro?"],
    });

    const request = await Effect.runPromise(
      buildVoiceTextTurnRequest(worldRef, turnIds, "quanto gastei em setembro?")
    );
    expect({
      admission: request.input.providerAdmission,
      profile: request.input.profileId,
      text: request.input.userText,
    }).toStrictEqual({
      admission: "opencode-zen",
      profile: "eve-opencode-zen-v1",
      text: "quanto gastei em setembro?",
    });
  });

  it("ZA-21-02a: unsupported browser keeps text usable without fabricated transcript", async () => {
    const session = createVoiceSession({
      listenOnce: () =>
        Promise.reject(
          new Error("must not start recognition when API missing")
        ),
      readCapabilities: () => missing,
      speakText: () => Promise.reject(new Error("must not speak")),
      submitTextTurn: () =>
        Promise.reject(new Error("must not submit via voice when unavailable")),
    });

    expect({
      hidden: session.snapshot().hiddenListenerActive,
      listening: session.snapshot().listening,
      phase: session.snapshot().phase,
      reason: session.snapshot().unavailableReason,
      textUsable: session.snapshot().textTurnUsable,
      transcript: session.snapshot().transcript,
    }).toStrictEqual({
      hidden: false,
      listening: false,
      phase: "unavailable",
      reason: "api-missing",
      textUsable: true,
      transcript: "",
    });

    const afterStart = await session.startSpeech();
    const request = await Effect.runPromise(
      buildVoiceTextTurnRequest(worldRef, turnIds, "typed fallback still works")
    );
    expect({
      admission: request.input.providerAdmission,
      afterHidden: afterStart.hiddenListenerActive,
      afterPhase: afterStart.phase,
      afterTranscript: afterStart.transcript,
      text: request.input.userText,
    }).toStrictEqual({
      admission: "opencode-zen",
      afterHidden: false,
      afterPhase: "unavailable",
      afterTranscript: "",
      text: "typed fallback still works",
    });
  });

  it("ZA-21-02b: denied microphone yields permission-denied without fabricated words", async () => {
    const session = createVoiceSession({
      listenOnce: () =>
        Promise.reject(
          new EveWebSpeechError({
            message: "eve-web-speech: recognition error not-allowed",
            reason: "permission-denied",
          })
        ),
      readCapabilities: () => capable,
      speakText: () => Promise.resolve(),
      submitTextTurn: () =>
        Promise.resolve({
          phase: "Settled",
          visibleText: "should not settle",
        }),
    });

    const after = await session.startSpeech();
    expect({
      hidden: after.hiddenListenerActive,
      phase: after.phase,
      reason: after.unavailableReason,
      textUsable: after.textTurnUsable,
      transcript: after.transcript,
    }).toStrictEqual({
      hidden: false,
      phase: "unavailable",
      reason: "permission-denied",
      textUsable: true,
      transcript: "",
    });
  });

  it("ZA-21-03a: cancel during recognition stops without settle", async () => {
    let releaseListen!: () => void;
    const listenGate = new Promise<void>((resolve) => {
      releaseListen = resolve;
    });
    let submitted = 0;

    const session = createVoiceSession({
      listenOnce: ({ signal }) =>
        new Promise((resolve, reject) => {
          if (signal.aborted) {
            reject(new DOMException("Aborted", "AbortError"));
            return;
          }
          signal.addEventListener(
            "abort",
            () => {
              reject(new DOMException("Aborted", "AbortError"));
            },
            { once: true }
          );
          void listenGate.then(() => {
            resolve("should-not-surface");
          });
        }),
      readCapabilities: () => capable,
      speakText: () => Promise.resolve(),
      submitTextTurn: () => {
        submitted += 1;
        return Promise.resolve({ phase: "Settled", visibleText: "nope" });
      },
    });

    const startPromise = session.startSpeech();
    await Promise.resolve();
    const cancelled = session.cancel();
    releaseListen();
    const finalSnap = await startPromise;

    expect({
      cancelledListening: cancelled.listening,
      cancelledPhase: cancelled.phase,
      finalPhase: finalSnap.phase,
      finalTranscript: finalSnap.transcript,
      submitted,
    }).toStrictEqual({
      cancelledListening: false,
      cancelledPhase: "cancelled",
      finalPhase: "cancelled",
      finalTranscript: "",
      submitted: 0,
    });
  });

  it("ZA-21-03b: cancel during speech stops output; no further unauthorized settle", async () => {
    let releaseSpeak!: () => void;
    const speakGate = new Promise<void>((resolve) => {
      releaseSpeak = resolve;
    });
    let submitCount = 0;
    let speakStarted = false;
    let cancelledDuringSpeak = false;
    let resolveStarted!: () => void;
    const startedGate = new Promise<void>((resolve) => {
      resolveStarted = resolve;
    });

    const session = createVoiceSession({
      listenOnce: () => Promise.resolve("olá"),
      readCapabilities: () => capable,
      speakText: (_text, { signal }) => {
        speakStarted = true;
        resolveStarted();
        return new Promise((resolve, reject) => {
          if (signal.aborted) {
            cancelledDuringSpeak = true;
            reject(new DOMException("Aborted", "AbortError"));
            return;
          }
          signal.addEventListener(
            "abort",
            () => {
              cancelledDuringSpeak = true;
              reject(new DOMException("Aborted", "AbortError"));
            },
            { once: true }
          );
          void speakGate.then(() => {
            resolve();
          });
        });
      },
      submitTextTurn: () => {
        submitCount += 1;
        return Promise.resolve({
          phase: "Settled",
          visibleText: "resposta autorizada",
        });
      },
    });

    await session.startSpeech();
    const confirmPromise = session.confirmTranscript();
    await startedGate;
    const mid = session.cancel();
    releaseSpeak();
    const done = await confirmPromise;

    expect({
      cancelledDuringSpeak,
      donePhase: done.phase,
      midPhase: mid.phase,
      speakStarted,
      submitCount,
    }).toStrictEqual({
      cancelledDuringSpeak: true,
      donePhase: "cancelled",
      midPhase: "cancelled",
      speakStarted: true,
      submitCount: 1,
    });
  });

  it("createBrowserVoiceSession wires defaults and refuses cloud speech binding", () => {
    const session = createBrowserVoiceSession({
      listenOnce: () => Promise.resolve("x"),
      readCapabilities: () => capable,
      speakText: () => Promise.resolve(),
      submitTextTurn: () =>
        Promise.resolve({
          phase: "Settled",
          visibleText: "ok",
        }),
    });
    expect({
      cloud: session.binding().cloudSpeechEnabled,
      grants: session.binding().grantsExtraAuthority,
      profile: session.binding().textProfileId,
    }).toStrictEqual({
      cloud: false,
      grants: false,
      profile: "eve-opencode-zen-v1",
    });
  });
});
