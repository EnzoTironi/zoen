import type { EveWebSpeechCapabilities } from "@zoen/contracts/eve/values";
import {
  probeWebSpeechCapabilities,
  voiceRecognitionReady,
  voiceSynthesisReady,
} from "@zoen/contracts/eve/web-speech";

/**
 * Browser Web Speech adapter for Eve voice (ZN-0063 / EX44).
 * Uses SpeechRecognition + speechSynthesis — not a stub, not cloud STT/TTS.
 */

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { readonly error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEventLike = {
  readonly results: ArrayLike<{
    readonly isFinal: boolean;
    readonly 0?: { readonly transcript: string };
  }>;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

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
    throw new Error("eve-web-speech: SpeechRecognition unavailable");
  }
  return capabilities;
};

export const assertVoiceSpeechReady = (
  capabilities: EveWebSpeechCapabilities = readWebSpeechCapabilities()
): EveWebSpeechCapabilities => {
  if (!voiceSynthesisReady(capabilities)) {
    throw new Error("eve-web-speech: speechSynthesis unavailable");
  }
  return capabilities;
};

/** One-shot STT → final transcript string (rejects if recognition missing). */
export const listenOnce = (options?: {
  readonly lang?: string;
  readonly signal?: AbortSignal;
}): Promise<string> => {
  const ctor = recognitionCtor();
  if (ctor === null) {
    return Promise.reject(
      new Error("eve-web-speech: SpeechRecognition unavailable")
    );
  }

  return new Promise((resolve, reject) => {
    const recognition = new ctor();
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

    const onAbort = () => {
      finish(() => {
        try {
          recognition.stop();
        } catch {
          // ignore
        }
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
        if (row?.isFinal === true && row[0]?.transcript !== undefined) {
          parts.push(row[0].transcript);
        }
      }
      const transcript = parts.join(" ").trim();
      finish(() => {
        if (transcript.length === 0) {
          reject(new Error("eve-web-speech: empty transcript"));
          return;
        }
        resolve(transcript);
      });
    };

    recognition.onerror = (event) => {
      finish(() => {
        reject(new Error(`eve-web-speech: recognition error ${event.error}`));
      });
    };

    recognition.onend = () => {
      finish(() => {
        reject(new Error("eve-web-speech: recognition ended without result"));
      });
    };

    recognition.start();
  });
};

/** Speak settled Eve reply text (rejects if synthesis missing). */
export const speakText = (
  text: string,
  options?: { readonly lang?: string }
): Promise<void> => {
  try {
    assertVoiceSpeechReady();
  } catch (error) {
    return Promise.reject(error);
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return Promise.resolve();
  }
  const synthesis = globalThis.speechSynthesis;
  if (synthesis === undefined) {
    return Promise.reject(
      new Error("eve-web-speech: speechSynthesis unavailable")
    );
  }

  return new Promise((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(trimmed);
    utterance.lang = options?.lang ?? "pt-BR";
    utterance.onend = () => {
      resolve();
    };
    utterance.onerror = () => {
      reject(new Error("eve-web-speech: speechSynthesis error"));
    };
    synthesis.speak(utterance);
  });
};
