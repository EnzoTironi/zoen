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

export const captureVoiceIngress = async (options?: {
  readonly lang?: string;
  readonly signal?: AbortSignal;
}): Promise<VoiceIngressResult> => {
  const capabilities = readWebSpeechCapabilities();
  const transcript = await listenOnce(options);
  return { capabilities, transcript };
};

export const speakSettledReply = async (
  visibleText: string,
  options?: { readonly lang?: string }
): Promise<void> => {
  await speakText(visibleText, options);
};
