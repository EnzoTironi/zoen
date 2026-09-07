import { describe, expect, it } from "@effect/vitest";

import {
  assertVoiceIngressReady,
  listenOnce,
  readWebSpeechCapabilities,
  speakText,
} from "../../../src/features/eve/web-speech.ts";

describe("EX44 Eve web-speech browser adapter", () => {
  it("Node host has no Web Speech — capabilities fail-closed", () => {
    const caps = readWebSpeechCapabilities();
    expect(caps).toStrictEqual({
      admission: "web-speech",
      profileId: "eve-web-speech-v1",
      recognitionAvailable: false,
      synthesisAvailable: false,
    });
    expect(() => assertVoiceIngressReady(caps)).toThrow(/SpeechRecognition/u);
  });

  it("listenOnce rejects when SpeechRecognition is absent", async () => {
    await expect(listenOnce()).rejects.toThrow(/SpeechRecognition/u);
  });

  it("speakText rejects when speechSynthesis is absent", async () => {
    await expect(speakText("eve-ok")).rejects.toThrow(/speechSynthesis/u);
  });
});
