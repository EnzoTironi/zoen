import type { EveWebSpeechCapabilities } from "./values.js";

/**
 * Pure Web Speech capability probe (ZN-0063 / EX44).
 * Shared by authority ports and `@zoen/web` — no network, no keys.
 */

export interface EveSpeechHost {
  readonly SpeechRecognition?: unknown;
  readonly webkitSpeechRecognition?: unknown;
  readonly speechSynthesis?: { readonly speak?: unknown } | null;
}

export const probeWebSpeechCapabilities = (
  host: EveSpeechHost
): EveWebSpeechCapabilities => {
  const recognitionAvailable =
    host.SpeechRecognition !== undefined ||
    host.webkitSpeechRecognition !== undefined;
  const synthesisAvailable =
    host.speechSynthesis !== undefined &&
    host.speechSynthesis !== null &&
    typeof host.speechSynthesis.speak === "function";
  return {
    admission: "web-speech",
    profileId: "eve-web-speech-v1",
    recognitionAvailable,
    synthesisAvailable,
  };
};

export const voiceRecognitionReady = (
  capabilities: EveWebSpeechCapabilities
): boolean =>
  capabilities.admission === "web-speech" &&
  capabilities.profileId === "eve-web-speech-v1" &&
  capabilities.recognitionAvailable;

export const voiceSynthesisReady = (
  capabilities: EveWebSpeechCapabilities
): boolean =>
  capabilities.admission === "web-speech" &&
  capabilities.profileId === "eve-web-speech-v1" &&
  capabilities.synthesisAvailable;
