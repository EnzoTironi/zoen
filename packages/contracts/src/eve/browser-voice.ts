import { Schema } from "effect";

import { exact } from "../worlds/values.js";
import { EveOpenCodeZenProfileId, EveWebSpeechProfileId } from "./values.js";

/**
 * ZA-21 — Browser voice as optional I/O over the admitted text turn.
 * Not cloud speech. Not a second conversation or authority channel.
 * Transcript is user input for review/correction, never domain evidence.
 */

/** Explicit product gate: cloud STT/TTS stays disabled in this increment. */
export const CLOUD_SPEECH_ENABLED = false as const;

/** Voice I/O channel identity — does not grant domain authority. */
export const EveBrowserVoiceChannel = Schema.Literal("browser-web-speech-io");
export type EveBrowserVoiceChannel = typeof EveBrowserVoiceChannel.Type;

/**
 * Visible session phases for the browser adapter.
 * Continuous background capture is never a phase.
 */
export const EveBrowserVoicePhase = Schema.Literals([
  "idle",
  "unavailable",
  "recording",
  "reviewing",
  "submitting",
  "speaking",
  "cancelled",
]);
export type EveBrowserVoicePhase = typeof EveBrowserVoicePhase.Type;

export const EveBrowserVoiceUnavailableReason = Schema.Literals([
  "api-missing",
  "permission-denied",
  "recognition-error",
  "synthesis-missing",
  "synthesis-error",
  "cloud-speech-disabled",
]);
export type EveBrowserVoiceUnavailableReason =
  typeof EveBrowserVoiceUnavailableReason.Type;

/** User-visible control ids for the voice adapter chrome. */
export const EveBrowserVoiceControlId = Schema.Literals([
  "start-speech",
  "cancel",
  "edit-transcript",
  "confirm-transcript",
  "stop-speech",
]);
export type EveBrowserVoiceControlId = typeof EveBrowserVoiceControlId.Type;

export const EveBrowserVoiceControl = Schema.Struct({
  enabled: Schema.Boolean,
  id: EveBrowserVoiceControlId,
  visible: Schema.Boolean,
}).annotate(exact);
export type EveBrowserVoiceControl = typeof EveBrowserVoiceControl.Type;

/**
 * Adapter binds STT/TTS to the grounded text profile (ZA-20), not a
 * voice-specific business policy. Changing channel does not grant authority.
 */
export const EveBrowserVoiceTextTurnBinding = Schema.Struct({
  cloudSpeechEnabled: Schema.Literal(false),
  grantsExtraAuthority: Schema.Literal(false),
  textProfileId: EveOpenCodeZenProfileId,
  textProviderAdmission: Schema.Literal("opencode-zen"),
  voiceIoProfileId: EveWebSpeechProfileId,
}).annotate(exact);
export type EveBrowserVoiceTextTurnBinding =
  typeof EveBrowserVoiceTextTurnBinding.Type;

export const browserVoiceTextTurnBinding =
  (): EveBrowserVoiceTextTurnBinding => ({
    cloudSpeechEnabled: false,
    grantsExtraAuthority: false,
    textProfileId: "eve-opencode-zen-v1",
    textProviderAdmission: "opencode-zen",
    voiceIoProfileId: "eve-web-speech-v1",
  });

/** Speech output is allowed only for an authorized settled visible reply. */
export const maySpeakAuthorizedSettledReply = (input: {
  readonly cancelled: boolean;
  readonly phase: "Accepted" | "Cancelled" | "Interrupted" | "Settled";
  readonly visibleText: string;
}): boolean => {
  if (input.cancelled) {
    return false;
  }
  if (input.phase !== "Settled") {
    return false;
  }
  return input.visibleText.trim().length > 0;
};

/** Map Web Speech recognition error codes to adapter unavailable reasons. */
export const unavailableReasonFromRecognitionError = (
  errorCode: string
): EveBrowserVoiceUnavailableReason => {
  if (errorCode === "not-allowed" || errorCode === "service-not-allowed") {
    return "permission-denied";
  }
  return "recognition-error";
};
