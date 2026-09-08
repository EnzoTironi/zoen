import { describe, expect, it } from "@effect/vitest";
import { browserVoiceTextTurnBinding } from "@zoen/contracts/eve/browser-voice";
import type {
  EveBrowserVoiceControlId,
  EveBrowserVoicePhase,
} from "@zoen/contracts/eve/browser-voice";
import type { EveWebSpeechCapabilities } from "@zoen/contracts/eve/values";
import { WorldRef } from "@zoen/contracts/worlds/values";
import { Effect, Schema } from "effect";

import {
  buildVoiceTextTurnRequest,
  createBrowserVoiceSession,
} from "../../../src/features/eve/voice-pipeline.ts";
import {
  browserVoiceControlsFor,
  createVoiceSession,
} from "../../../src/features/eve/voice-session.ts";
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

const controlRow = (
  phase: EveBrowserVoicePhase,
  transcript: string,
  id: EveBrowserVoiceControlId
) => {
  const row = browserVoiceControlsFor(phase, transcript).find(
    (control) => control.id === id
  );
  if (row === undefined) {
    throw new Error(`missing control ${id}`);
  }
  return row;
};

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

  it("ZA-21-01c: browserVoiceControlsFor maps every phase/transcript case directly", () => {
    const phases: readonly EveBrowserVoicePhase[] = [
      "idle",
      "unavailable",
      "recording",
      "reviewing",
      "submitting",
      "speaking",
      "cancelled",
    ];
    const mapped = phases.flatMap((phase) => [
      {
        case: `${phase}/start`,
        row: controlRow(phase, "", "start-speech"),
      },
      {
        case: `${phase}/cancel`,
        row: controlRow(phase, "", "cancel"),
      },
      {
        case: `${phase}/edit`,
        row: controlRow(phase, "ok", "edit-transcript"),
      },
      {
        case: `${phase}/confirm-empty`,
        row: controlRow(phase, "", "confirm-transcript"),
      },
      {
        case: `${phase}/confirm-text`,
        row: controlRow(phase, "ok", "confirm-transcript"),
      },
      {
        case: `${phase}/stop`,
        row: controlRow(phase, "", "stop-speech"),
      },
    ]);
    expect(
      mapped.map((entry) => ({
        case: entry.case,
        enabled: entry.row.enabled,
        id: entry.row.id,
        visible: entry.row.visible,
      }))
    ).toStrictEqual(
      phases.flatMap((phase) => [
        {
          case: `${phase}/start`,
          enabled: phase === "idle" || phase === "cancelled",
          id: "start-speech",
          visible: phase !== "unavailable",
        },
        {
          case: `${phase}/cancel`,
          enabled:
            phase === "recording" ||
            phase === "reviewing" ||
            phase === "submitting" ||
            phase === "speaking",
          id: "cancel",
          visible: true,
        },
        {
          case: `${phase}/edit`,
          enabled: phase === "reviewing",
          id: "edit-transcript",
          visible: phase === "reviewing" || phase === "submitting",
        },
        {
          case: `${phase}/confirm-empty`,
          enabled: false,
          id: "confirm-transcript",
          visible: phase === "reviewing" || phase === "submitting",
        },
        {
          case: `${phase}/confirm-text`,
          enabled: phase === "reviewing",
          id: "confirm-transcript",
          visible: phase === "reviewing" || phase === "submitting",
        },
        {
          case: `${phase}/stop`,
          enabled: phase === "speaking",
          id: "stop-speech",
          visible: phase === "speaking" || phase === "idle",
        },
      ])
    );
  });

  it("ZA-21-03c: cancel during submit invokes domain CancelConversationTurn dependency", async () => {
    let releaseSubmit!: () => void;
    const submitGate = new Promise<void>((resolve) => {
      releaseSubmit = resolve;
    });
    let domainCancels = 0;
    let submitStarted = false;
    let resolveStarted!: () => void;
    const startedGate = new Promise<void>((resolve) => {
      resolveStarted = resolve;
    });

    const session = createVoiceSession({
      cancelSubmittedTurn: () => {
        domainCancels += 1;
      },
      listenOnce: () => Promise.resolve("cancel me after submit"),
      readCapabilities: () => capable,
      speakText: () => Promise.reject(new Error("must not speak after cancel")),
      submitTextTurn: ({ signal }) =>
        new Promise((resolve, reject) => {
          submitStarted = true;
          resolveStarted();
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
          void submitGate.then(() => {
            resolve({
              phase: "Settled",
              visibleText: "should not speak",
            });
          });
        }),
    });

    await session.startSpeech();
    const confirmPromise = session.confirmTranscript();
    await startedGate;
    expect(submitStarted).toBeTruthy();
    const mid = session.cancel();
    releaseSubmit();
    const done = await confirmPromise;

    expect({
      domainCancels,
      donePhase: done.phase,
      midPhase: mid.phase,
      settled: done.settledSpeakText,
    }).toStrictEqual({
      domainCancels: 1,
      donePhase: "cancelled",
      midPhase: "cancelled",
      settled: null,
    });
  });

  it("ZA-21-03d: superseded recognition cannot mark a newer recording cancelled", async () => {
    let firstAbortHandler: (() => void) | undefined;
    let firstResolve!: (value: string) => void;
    const firstListen = new Promise<string>((resolve) => {
      firstResolve = resolve;
    });
    let listenCalls = 0;

    const session = createVoiceSession({
      listenOnce: ({ signal }) => {
        listenCalls += 1;
        if (listenCalls === 1) {
          return new Promise((resolve, reject) => {
            if (signal.aborted) {
              reject(new DOMException("Aborted", "AbortError"));
              return;
            }
            firstAbortHandler = () => {
              reject(new DOMException("Aborted", "AbortError"));
            };
            signal.addEventListener("abort", firstAbortHandler, { once: true });
            void firstListen.then(resolve);
          });
        }
        return Promise.resolve("second transcript");
      },
      readCapabilities: () => capable,
      speakText: () => Promise.resolve(),
      submitTextTurn: () =>
        Promise.resolve({ phase: "Settled", visibleText: "n/a" }),
    });

    const firstStart = session.startSpeech();
    await Promise.resolve();
    const second = await session.startSpeech();
    // Stale first abort must not overwrite the second recording/review.
    firstAbortHandler?.();
    firstResolve("stale-first");
    const stale = await firstStart;
    const finalSnap = session.snapshot();

    expect({
      finalPhase: finalSnap.phase,
      finalTranscript: finalSnap.transcript,
      listenCalls,
      secondPhase: second.phase,
      secondTranscript: second.transcript,
      staleCancelled: stale.phase === "cancelled",
    }).toStrictEqual({
      finalPhase: "reviewing",
      finalTranscript: "second transcript",
      listenCalls: 2,
      secondPhase: "reviewing",
      secondTranscript: "second transcript",
      staleCancelled: false,
    });
  });

  it("ZA-21-03e: capability-failed restart stops prior recognition first", async () => {
    let caps: EveWebSpeechCapabilities = capable;
    let listenCalls = 0;
    let releaseListen!: () => void;
    const listenGate = new Promise<void>((resolve) => {
      releaseListen = resolve;
    });

    const session = createVoiceSession({
      listenOnce: ({ signal }) => {
        listenCalls += 1;
        return new Promise((resolve, reject) => {
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
            resolve("should-not-restore-reviewing");
          });
        });
      },
      readCapabilities: () => caps,
      speakText: () => Promise.resolve(),
      submitTextTurn: () =>
        Promise.resolve({ phase: "Settled", visibleText: "n/a" }),
    });

    const first = session.startSpeech();
    await Promise.resolve();
    expect(session.snapshot().phase).toBe("recording");
    caps = missing;
    const second = await session.startSpeech();
    releaseListen();
    const stale = await first;

    expect({
      listenCalls,
      secondPhase: second.phase,
      secondReason: second.unavailableReason,
      stalePhase: stale.phase,
      transcript: session.snapshot().transcript,
    }).toStrictEqual({
      listenCalls: 1,
      secondPhase: "unavailable",
      secondReason: "api-missing",
      stalePhase: "unavailable",
      transcript: "",
    });
  });
});
