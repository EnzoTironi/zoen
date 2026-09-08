import {
  browserVoiceTextTurnBinding,
  maySpeakAuthorizedSettledReply,
} from "@zoen/contracts/eve/browser-voice";
import type {
  EveBrowserVoiceControl,
  EveBrowserVoicePhase,
  EveBrowserVoiceUnavailableReason,
} from "@zoen/contracts/eve/browser-voice";
import type { EveWebSpeechCapabilities } from "@zoen/contracts/eve/values";
import { voiceRecognitionReady } from "@zoen/contracts/eve/web-speech";

import { EveWebSpeechError } from "./web-speech.ts";

/**
 * ZA-21 browser voice session — optional adapter over the admitted text turn.
 *
 * Explicit start → record once → review/correct transcript → submit text turn
 * → speak authorized settled reply. No continuous listening. No cloud speech.
 * Cancel/revoke stops at the boundary and does not settle further messages.
 */

export interface VoiceSessionDeps {
  readonly listenOnce: (options: {
    readonly lang?: string;
    readonly signal: AbortSignal;
  }) => Promise<string>;
  readonly readCapabilities: () => EveWebSpeechCapabilities;
  readonly speakText: (
    text: string,
    options: { readonly lang?: string; readonly signal: AbortSignal }
  ) => Promise<void>;
  readonly submitTextTurn: (input: {
    readonly signal: AbortSignal;
    readonly userText: string;
  }) => Promise<{
    readonly phase: "Accepted" | "Cancelled" | "Interrupted" | "Settled";
    readonly visibleText: string;
  }>;
  readonly cancelSpeechOutput?: () => void;
  readonly lang?: string;
}

export interface VoiceSessionSnapshot {
  readonly cancelled: boolean;
  readonly capabilities: EveWebSpeechCapabilities;
  readonly controls: readonly EveBrowserVoiceControl[];
  readonly hiddenListenerActive: boolean;
  readonly listening: boolean;
  readonly phase: EveBrowserVoicePhase;
  readonly settledSpeakText: string | null;
  /** Text product remains usable even when voice is unavailable. */
  readonly textTurnUsable: boolean;
  readonly transcript: string;
  readonly unavailableReason: EveBrowserVoiceUnavailableReason | null;
}

const controlsFor = (
  phase: EveBrowserVoicePhase,
  transcript: string
): readonly EveBrowserVoiceControl[] => {
  const hasTranscript = transcript.trim().length > 0;
  return [
    {
      enabled: phase === "idle" || phase === "cancelled",
      id: "start-speech",
      visible: phase !== "unavailable",
    },
    {
      enabled:
        phase === "recording" ||
        phase === "reviewing" ||
        phase === "submitting" ||
        phase === "speaking",
      id: "cancel",
      visible: true,
    },
    {
      enabled: phase === "reviewing",
      id: "edit-transcript",
      visible: phase === "reviewing" || phase === "submitting",
    },
    {
      enabled: phase === "reviewing" && hasTranscript,
      id: "confirm-transcript",
      visible: phase === "reviewing" || phase === "submitting",
    },
    {
      enabled: phase === "speaking",
      id: "stop-speech",
      visible: phase === "speaking" || phase === "idle",
    },
  ];
};

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";

export const createVoiceSession = (deps: VoiceSessionDeps) => {
  const binding = browserVoiceTextTurnBinding();
  let capabilities = deps.readCapabilities();
  let phase: EveBrowserVoicePhase = voiceRecognitionReady(capabilities)
    ? "idle"
    : "unavailable";
  let unavailableReason: EveBrowserVoiceUnavailableReason | null =
    phase === "unavailable" ? "api-missing" : null;
  let transcript = "";
  let settledSpeakText: string | null = null;
  let cancelled = false;
  let listening = false;
  let runAbort: AbortController | null = null;

  const snapshot = (): VoiceSessionSnapshot => ({
    cancelled,
    capabilities,
    controls: controlsFor(phase, transcript),
    // Continuous / hidden background capture is never armed.
    hiddenListenerActive: false,
    listening,
    phase,
    settledSpeakText,
    textTurnUsable: true,
    transcript,
    unavailableReason,
  });

  const stopActive = () => {
    runAbort?.abort();
    runAbort = null;
    listening = false;
    deps.cancelSpeechOutput?.();
  };

  const startSpeech = async (): Promise<VoiceSessionSnapshot> => {
    capabilities = deps.readCapabilities();
    if (!voiceRecognitionReady(capabilities)) {
      phase = "unavailable";
      unavailableReason = "api-missing";
      listening = false;
      return snapshot();
    }
    if (binding.cloudSpeechEnabled) {
      phase = "unavailable";
      unavailableReason = "cloud-speech-disabled";
      return snapshot();
    }

    stopActive();
    cancelled = false;
    settledSpeakText = null;
    transcript = "";
    unavailableReason = null;
    phase = "recording";
    listening = true;
    const controller = new AbortController();
    runAbort = controller;

    try {
      const heard = await deps.listenOnce({
        signal: controller.signal,
        ...(deps.lang === undefined ? {} : { lang: deps.lang }),
      });
      if (controller.signal.aborted || cancelled) {
        phase = "cancelled";
        listening = false;
        return snapshot();
      }
      transcript = heard;
      phase = "reviewing";
      listening = false;
      return snapshot();
    } catch (error) {
      listening = false;
      if (isAbortError(error) || cancelled) {
        phase = "cancelled";
        return snapshot();
      }
      if (error instanceof EveWebSpeechError) {
        phase = "unavailable";
        unavailableReason = error.reason;
        // Never fabricate a transcript on denial/error.
        transcript = "";
        return snapshot();
      }
      phase = "unavailable";
      unavailableReason = "recognition-error";
      transcript = "";
      return snapshot();
    } finally {
      if (runAbort === controller) {
        runAbort = null;
      }
    }
  };

  const setTranscript = (next: string): VoiceSessionSnapshot => {
    if (phase !== "reviewing") {
      return snapshot();
    }
    // User may inspect/correct; transcript remains user input, not evidence.
    transcript = next;
    return snapshot();
  };

  const confirmTranscript = async (): Promise<VoiceSessionSnapshot> => {
    if (phase !== "reviewing") {
      return snapshot();
    }
    const userText = transcript.trim();
    if (userText.length === 0) {
      return snapshot();
    }

    const controller = new AbortController();
    runAbort = controller;
    cancelled = false;
    phase = "submitting";

    try {
      const settled = await deps.submitTextTurn({
        signal: controller.signal,
        userText,
      });
      if (controller.signal.aborted || cancelled) {
        phase = "cancelled";
        settledSpeakText = null;
        return snapshot();
      }
      if (
        !maySpeakAuthorizedSettledReply({
          cancelled: false,
          phase: settled.phase,
          visibleText: settled.visibleText,
        })
      ) {
        phase = "idle";
        settledSpeakText = null;
        return snapshot();
      }

      settledSpeakText = settled.visibleText.trim();
      phase = "speaking";
      await deps.speakText(settledSpeakText, {
        signal: controller.signal,
        ...(deps.lang === undefined ? {} : { lang: deps.lang }),
      });
      if (controller.signal.aborted || cancelled) {
        phase = "cancelled";
        return snapshot();
      }
      phase = "idle";
      return snapshot();
    } catch (error) {
      if (isAbortError(error) || cancelled) {
        phase = "cancelled";
        settledSpeakText = null;
        return snapshot();
      }
      if (error instanceof EveWebSpeechError) {
        phase = "unavailable";
        unavailableReason = error.reason;
        return snapshot();
      }
      throw error;
    } finally {
      if (runAbort === controller) {
        runAbort = null;
      }
      listening = false;
    }
  };

  const cancel = (): VoiceSessionSnapshot => {
    cancelled = true;
    stopActive();
    // If we were only reviewing, drop pending submit; no settle after cancel.
    if (
      phase === "recording" ||
      phase === "reviewing" ||
      phase === "submitting" ||
      phase === "speaking"
    ) {
      phase = "cancelled";
    }
    listening = false;
    return snapshot();
  };

  const stopSpeech = (): VoiceSessionSnapshot => {
    if (phase === "speaking") {
      cancelled = true;
      stopActive();
      phase = "cancelled";
    }
    return snapshot();
  };

  return {
    binding: () => binding,
    cancel,
    confirmTranscript,
    setTranscript,
    snapshot,
    startSpeech,
    stopSpeech,
  };
};

export type VoiceSession = ReturnType<typeof createVoiceSession>;
