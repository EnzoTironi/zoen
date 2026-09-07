import type { EveWebSpeechCapabilities } from "@zoen/contracts/eve/values";

import {
  listenOnce,
  readWebSpeechCapabilities,
  speakText,
} from "./web-speech.ts";

/**
 * Browser-side voice pipeline helpers.
 * Authority `runEveVoiceTurn` owns journal+model; this module owns STT/TTS only.
 */

export interface VoiceIngressResult {
  readonly capabilities: EveWebSpeechCapabilities;
  readonly transcript: string;
}

export const captureVoiceIngress = (options?: {
  readonly lang?: string;
  readonly signal?: AbortSignal;
}): Promise<VoiceIngressResult> => {
  const capabilities = readWebSpeechCapabilities();
  return listenOnce(options).then((transcript) => ({
    capabilities,
    transcript,
  }));
};

export const speakSettledReply = (
  visibleText: string,
  options?: { readonly lang?: string }
): Promise<void> => speakText(visibleText, options);
