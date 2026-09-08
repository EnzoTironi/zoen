/**
 * ZA-21 — Server-side policy for browser voice I/O.
 *
 * Voice is an optional adapter over the same admitted text turn (ZA-20).
 * Changing channel does not grant extra authority. Cloud speech stays disabled.
 * Product Eve / G-PROVIDER remain fail-closed until independently qualified.
 */
import {
  CLOUD_SPEECH_ENABLED,
  browserVoiceTextTurnBinding,
  maySpeakAuthorizedSettledReply,
} from "@zoen/contracts/eve/browser-voice";
import type { EveBrowserVoiceTextTurnBinding } from "@zoen/contracts/eve/browser-voice";

/** Explicit product statement: cloud STT/TTS has no server implementation here. */
export const cloudSpeechProductEnabled = (): boolean => CLOUD_SPEECH_ENABLED;

/**
 * Voice ingress never upgrades admission or invents authority.
 * Settled speak-out requires an already-authorized Settled message.
 */
export const assertVoiceChannelGrantsNoExtraAuthority = (
  binding: EveBrowserVoiceTextTurnBinding = browserVoiceTextTurnBinding()
): void => {
  if (binding.grantsExtraAuthority) {
    throw new Error("eve-browser-voice: channel must not grant authority");
  }
  if (binding.cloudSpeechEnabled) {
    throw new Error("eve-browser-voice: cloud speech must stay disabled");
  }
  if (binding.textProviderAdmission !== "opencode-zen") {
    throw new Error("eve-browser-voice: text turn binding mismatch");
  }
  if (binding.textProfileId !== "eve-opencode-zen-v1") {
    throw new Error("eve-browser-voice: text profile binding mismatch");
  }
};

/** Refuse speaking after cancel/revoke or for non-settled turns. */
export const allowSpeechOutputForSettledTurn = (input: {
  readonly cancelled: boolean;
  readonly phase: "Accepted" | "Cancelled" | "Interrupted" | "Settled";
  readonly visibleText: string;
}): boolean => {
  assertVoiceChannelGrantsNoExtraAuthority();
  return maySpeakAuthorizedSettledReply(input);
};
