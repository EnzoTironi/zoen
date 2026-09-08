import { describe, expect, it } from "@effect/vitest";
import {
  CLOUD_SPEECH_ENABLED,
  browserVoiceTextTurnBinding,
  maySpeakAuthorizedSettledReply,
  unavailableReasonFromRecognitionError,
} from "@zoen/contracts/eve/browser-voice";

import {
  allowSpeechOutputForSettledTurn,
  assertVoiceChannelGrantsNoExtraAuthority,
  cloudSpeechProductEnabled,
} from "../../../../server/src/eve/browser-voice.ts";

describe("ZA-21 browser voice contracts + server policy", () => {
  it("keeps cloud speech disabled and grants no extra authority", () => {
    expect(CLOUD_SPEECH_ENABLED).toBeFalsy();
    expect(cloudSpeechProductEnabled()).toBeFalsy();
    const binding = browserVoiceTextTurnBinding();
    expect(binding).toStrictEqual({
      cloudSpeechEnabled: false,
      grantsExtraAuthority: false,
      textProfileId: "eve-opencode-zen-v1",
      textProviderAdmission: "opencode-zen",
      voiceIoProfileId: "eve-web-speech-v1",
    });
    expect(() => {
      assertVoiceChannelGrantsNoExtraAuthority(binding);
    }).not.toThrow();
  });

  it("speaks only authorized settled replies; cancel blocks output", () => {
    expect(
      maySpeakAuthorizedSettledReply({
        cancelled: false,
        phase: "Settled",
        visibleText: "ok",
      })
    ).toBeTruthy();
    expect(
      allowSpeechOutputForSettledTurn({
        cancelled: true,
        phase: "Settled",
        visibleText: "ok",
      })
    ).toBeFalsy();
    expect(
      maySpeakAuthorizedSettledReply({
        cancelled: false,
        phase: "Cancelled",
        visibleText: "ok",
      })
    ).toBeFalsy();
    expect(
      maySpeakAuthorizedSettledReply({
        cancelled: false,
        phase: "Settled",
        visibleText: "   ",
      })
    ).toBeFalsy();
  });

  it("maps mic denial to permission-denied without inventing words", () => {
    expect(unavailableReasonFromRecognitionError("not-allowed")).toBe(
      "permission-denied"
    );
    expect(unavailableReasonFromRecognitionError("service-not-allowed")).toBe(
      "permission-denied"
    );
    expect(unavailableReasonFromRecognitionError("network")).toBe(
      "recognition-error"
    );
  });
});
