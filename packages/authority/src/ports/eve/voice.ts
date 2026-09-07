import {
  Blocked,
  Conflict,
  NotFoundOrDenied,
  Unavailable,
} from "@zoen/contracts/d01/errors";
import {
  probeWebSpeechCapabilities,
  voiceRecognitionReady,
  voiceSynthesisReady,
} from "@zoen/contracts/eve/web-speech";
import type {
  ConversationId,
  EveEvidenceLink,
  EveVisibleMessage,
  EveWebSpeechCapabilities,
  IngressId,
  MessageId,
  RelationshipId,
  TurnId,
} from "@zoen/contracts/eve/values";
import { Effect } from "effect";
import type { Effect as EffectType } from "effect";

import { EveJournal } from "./journal.js";
import { EveOpenCodeZen } from "./opencode-zen.js";
import { runEveTurn } from "./turn.js";
import type { RunEveTurnResult } from "./turn.js";

/**
 * EX44 — Eve voice profile (ZN-0063): browser Web Speech I/O.
 *
 * Separate product admission from text Zen (`eve-web-speech-v1` / `web-speech`).
 * STT/TTS are platform Web Speech APIs in `@zoen/web` — not cloud, not invented.
 * OpenCode Zen has no voice/TTS/whisper models; audio never routes to Zen.
 * Flow: transcript (STT) → accept/settle via Zen text completion → speakText (TTS).
 */

export {
  probeWebSpeechCapabilities,
  voiceRecognitionReady,
  voiceSynthesisReady,
};
export type { EveSpeechHost } from "@zoen/contracts/eve/web-speech";

export interface RunEveVoiceTurnInput {
  readonly capabilities: EveWebSpeechCapabilities;
  readonly conversationId: ConversationId;
  readonly evidenceLinks?: readonly EveEvidenceLink[];
  readonly ingressId: IngressId;
  readonly messageId: MessageId;
  readonly relationshipId: RelationshipId;
  readonly signal?: AbortSignal;
  readonly systemText?: string;
  readonly transcript: string;
  readonly turnId: TurnId;
}

export interface RunEveVoiceTurnResult {
  readonly capabilities: EveWebSpeechCapabilities;
  readonly message: EveVisibleMessage;
  readonly speakText: string;
  readonly synthesisReady: boolean;
  readonly turn: RunEveTurnResult["turn"];
}

type VoiceFailure = Blocked | Conflict | NotFoundOrDenied | Unavailable;

/**
 * Voice path: require Web Speech recognition → journal+Zen text turn → speak payload.
 * TTS playback stays in the browser; this port only returns `speakText`.
 */
export const runEveVoiceTurn = (
  input: RunEveVoiceTurnInput
): EffectType.Effect<
  RunEveVoiceTurnResult,
  VoiceFailure,
  EveJournal | EveOpenCodeZen
> =>
  Effect.gen(function* voice() {
    if (
      input.capabilities.admission !== "web-speech" ||
      input.capabilities.profileId !== "eve-web-speech-v1"
    ) {
      return yield* new Blocked({ code: "PROFILE_BLOCKED" });
    }
    if (!voiceRecognitionReady(input.capabilities)) {
      return yield* new Unavailable({ code: "UNAVAILABLE" });
    }

    const trimmed = input.transcript.trim();
    if (trimmed.length === 0) {
      return yield* new Unavailable({ code: "UNAVAILABLE" });
    }

    const result = yield* runEveTurn({
      conversationId: input.conversationId,
      ingressId: input.ingressId,
      messageId: input.messageId,
      profileId: "eve-web-speech-v1",
      providerAdmission: "web-speech",
      relationshipId: input.relationshipId,
      turnId: input.turnId,
      userText: trimmed,
      ...(input.evidenceLinks === undefined
        ? {}
        : { evidenceLinks: input.evidenceLinks }),
      ...(input.signal === undefined ? {} : { signal: input.signal }),
      ...(input.systemText === undefined
        ? {}
        : { systemText: input.systemText }),
    });

    return {
      capabilities: input.capabilities,
      message: result.message,
      speakText: result.message.visibleText,
      synthesisReady: voiceSynthesisReady(input.capabilities),
      turn: result.turn,
    };
  });
