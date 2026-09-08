import { unavailableReasonFromRecognitionError } from "@zoen/contracts/eve/browser-voice";
import type { EveBrowserVoiceUnavailableReason } from "@zoen/contracts/eve/browser-voice";
import type { EveWebSpeechCapabilities } from "@zoen/contracts/eve/values";
import {
  probeWebSpeechCapabilities,
  voiceRecognitionReady,
  voiceSynthesisReady,
} from "@zoen/contracts/eve/web-speech";
import { Data } from "effect";

/**
 * Browser Web Speech adapter for Eve voice (ZN-0063 / EX44 / ZA-21).
 * Uses SpeechRecognition + speechSynthesis — not a stub, not cloud STT/TTS.
 * One-shot explicit capture only; never continuous background listening.
 */

interface SpeechRecognitionEventLike {
  readonly results: ArrayLike<{
    readonly isFinal: boolean;
    readonly 0?: { readonly transcript: string };
  }>;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { readonly error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export class EveWebSpeechError extends Data.TaggedError("EveWebSpeechError")<{
  readonly message: string;
  readonly reason: EveBrowserVoiceUnavailableReason;
}> {}

const recognitionCtor = (): SpeechRecognitionCtor | null => {
  const host = globalThis as typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
};

export const readWebSpeechCapabilities = (): EveWebSpeechCapabilities =>
  probeWebSpeechCapabilities(globalThis);

export const assertVoiceIngressReady = (
  capabilities: EveWebSpeechCapabilities = readWebSpeechCapabilities()
): EveWebSpeechCapabilities => {
  if (!voiceRecognitionReady(capabilities)) {
    throw new EveWebSpeechError({
      message: "eve-web-speech: SpeechRecognition unavailable",
      reason: "api-missing",
    });
  }
  return capabilities;
};

export const assertVoiceSpeechReady = (
  capabilities: EveWebSpeechCapabilities = readWebSpeechCapabilities()
): EveWebSpeechCapabilities => {
  if (!voiceSynthesisReady(capabilities)) {
    throw new EveWebSpeechError({
      message: "eve-web-speech: speechSynthesis unavailable",
      reason: "synthesis-missing",
    });
  }
  return capabilities;
};

/** Stop any queued/current synthesis immediately (cancel/revoke boundary). */
export const cancelSpeechOutput = (): void => {
  const synthesis = globalThis.speechSynthesis;
  if (synthesis !== undefined && typeof synthesis.cancel === "function") {
    synthesis.cancel();
  }
};

/** One-shot STT → final transcript string (rejects if recognition missing). */
export const listenOnce = (options?: {
  readonly lang?: string;
  readonly signal?: AbortSignal;
}): Promise<string> => {
  const ctor = recognitionCtor();
  if (ctor === null) {
    return Promise.reject(
      new EveWebSpeechError({
        message: "eve-web-speech: SpeechRecognition unavailable",
        reason: "api-missing",
      })
    );
  }

  return new Promise((resolve, reject) => {
    const recognition = new ctor();
    // ZA-21: never continuous background capture.
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = options?.lang ?? "pt-BR";

    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      fn();
    };

    const stopRecognition = () => {
      try {
        if (typeof recognition.abort === "function") {
          recognition.abort();
        } else {
          recognition.stop();
        }
      } catch {
        // ignore stop races
      }
    };

    const onAbort = () => {
      finish(() => {
        stopRecognition();
        reject(new DOMException("Aborted", "AbortError"));
      });
    };

    if (options?.signal !== undefined) {
      if (options.signal.aborted) {
        onAbort();
        return;
      }
      options.signal.addEventListener("abort", onAbort, { once: true });
    }

    recognition.onresult = (event) => {
      const parts: string[] = [];
      for (let i = 0; i < event.results.length; i += 1) {
        const row = event.results[i];
        if (
          row !== undefined &&
          row.isFinal &&
          row[0]?.transcript !== undefined
        ) {
          parts.push(row[0].transcript);
        }
      }
      const transcript = parts.join(" ").trim();
      finish(() => {
        if (transcript.length === 0) {
          reject(
            new EveWebSpeechError({
              message: "eve-web-speech: empty transcript",
              reason: "recognition-error",
            })
          );
          return;
        }
        resolve(transcript);
      });
    };

    recognition.onerror = (event) => {
      finish(() => {
        const reason = unavailableReasonFromRecognitionError(event.error);
        reject(
          new EveWebSpeechError({
            message: `eve-web-speech: recognition error ${event.error}`,
            reason,
          })
        );
      });
    };

    recognition.onend = () => {
      finish(() => {
        reject(
          new EveWebSpeechError({
            message: "eve-web-speech: recognition ended without result",
            reason: "recognition-error",
          })
        );
      });
    };

    recognition.start();
  });
};

/** Speak settled Eve reply text; honors AbortSignal via speechSynthesis.cancel. */
export const speakText = (
  text: string,
  options?: { readonly lang?: string; readonly signal?: AbortSignal }
): Promise<void> => {
  try {
    assertVoiceSpeechReady();
  } catch (error) {
    return Promise.reject(
      error instanceof Error ? error : new Error(String(error))
    );
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return Promise.resolve();
  }
  const synthesis = globalThis.speechSynthesis;
  if (synthesis === undefined) {
    return Promise.reject(
      new EveWebSpeechError({
        message: "eve-web-speech: speechSynthesis unavailable",
        reason: "synthesis-missing",
      })
    );
  }

  return new Promise((resolve, reject) => {
    if (options?.signal?.aborted === true) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const utterance = new SpeechSynthesisUtterance(trimmed);
    utterance.lang = options?.lang ?? "pt-BR";
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      fn();
    };

    const onAbort = () => {
      finish(() => {
        cancelSpeechOutput();
        reject(new DOMException("Aborted", "AbortError"));
      });
    };

    if (options?.signal !== undefined) {
      options.signal.addEventListener("abort", onAbort, { once: true });
    }

    utterance.onend = () => {
      finish(() => {
        resolve();
      });
    };
    utterance.onerror = (event: { readonly error?: string }) => {
      finish(() => {
        const detail =
          typeof event.error === "string" && event.error.length > 0
            ? event.error
            : "unknown";
        reject(
          new EveWebSpeechError({
            message: `eve-web-speech: speechSynthesis playback error ${detail}`,
            reason: "synthesis-error",
          })
        );
      });
    };
    synthesis.speak(utterance);
  });
};
