# Eve (optional conversation)

Product Eve text/voice stays **fail-closed** until durable journal, evidence grounding, and narrow profile acceptance all qualify (ZA-17 → ZA-20). ZA-20 records acceptance for `eve-opencode-zen-v1` / `opencode-zen`; a host OpenCode key alone still does **not** admit the surface until journal (ZA-18) + grounding (ZA-19 / #107) + G-PROVIDER are present. Worlds UI remains usable while Eve routes return explicit `Blocked` / unavailable.

## Voice I/O (`eve-web-speech-v1` / ZA-21)

Browser **Web Speech API** is an **optional adapter** over the **same admitted text turn**:

1. Explicit user gesture starts one-shot `SpeechRecognition` (never continuous background capture)
2. User inspects/corrects the transcript (user input, not domain evidence)
3. Confirm submits via `AcceptConversationTurn` with `eve-opencode-zen-v1` / `opencode-zen`
4. Only an authorized **Settled** `visibleText` may be spoken via `speechSynthesis`
5. Cancel/revoke stops recognition/TTS at the boundary; no further unauthorized settle

Visible controls: start-speech, cancel, edit-transcript, confirm-transcript, stop-speech.

Not a stub. **Not cloud STT/TTS** (`CLOUD_SPEECH_ENABLED = false`). Fail-closed when browser APIs are missing, mic is denied, **or** product Eve is unadmitted. Changing channel does **not** grant extra authority. See `docs/verification/eve-web-speech.md` for the support matrix and what remains manual/Blocked for real-device speech.
