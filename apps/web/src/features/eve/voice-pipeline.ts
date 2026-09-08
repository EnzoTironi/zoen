import type { EveWebSpeechCapabilities } from "@zoen/contracts/eve/values";
import type { WorldRef } from "@zoen/contracts/worlds/values";

import { acceptEveTurnRequest } from "./requests.ts";
import { createVoiceSession } from "./voice-session.ts";
import type { VoiceSession, VoiceSessionDeps } from "./voice-session.ts";
import {
  cancelSpeechOutput,
  listenOnce,
  readWebSpeechCapabilities,
  speakText,
} from "./web-speech.ts";

/**
 * Browser-side voice pipeline (ZA-21).
 * STT/TTS only as optional I/O; the admitted text turn owns journal+model.
 * Changing channel does not grant extra authority. Cloud speech stays off.
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
  options?: { readonly lang?: string; readonly signal?: AbortSignal }
): Promise<void> => speakText(visibleText, options);

export interface BrowserVoiceTurnIds {
  readonly conversationId: string;
  readonly ingressId: string;
  readonly messageId: string;
  readonly relationshipId: string;
  readonly turnId: string;
}

/**
 * Build the same AcceptConversationTurn request the text UI uses (ZA-20 profile).
 * Voice never invents a second conversation policy.
 */
export const buildVoiceTextTurnRequest = (
  worldRef: WorldRef,
  ids: BrowserVoiceTurnIds,
  userText: string
) => acceptEveTurnRequest(worldRef, { ...ids, userText });

export interface CreateBrowserVoiceSessionOptions {
  readonly lang?: string;
  readonly submitTextTurn: VoiceSessionDeps["submitTextTurn"];
  readonly listenOnce?: VoiceSessionDeps["listenOnce"];
  readonly readCapabilities?: VoiceSessionDeps["readCapabilities"];
  readonly speakText?: VoiceSessionDeps["speakText"];
  readonly cancelSpeechOutput?: () => void;
}

/** Factory wired to real browser APIs + caller-provided text-turn submit. */
export const createBrowserVoiceSession = (
  options: CreateBrowserVoiceSessionOptions
): VoiceSession => {
  const deps: VoiceSessionDeps = {
    cancelSpeechOutput: options.cancelSpeechOutput ?? cancelSpeechOutput,
    listenOnce: options.listenOnce ?? listenOnce,
    readCapabilities: options.readCapabilities ?? readWebSpeechCapabilities,
    speakText: options.speakText ?? speakText,
    submitTextTurn: options.submitTextTurn,
    ...(options.lang === undefined ? {} : { lang: options.lang }),
  };
  return createVoiceSession(deps);
};
