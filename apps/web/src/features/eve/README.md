# Eve (optional conversation)

Product Eve text/voice stays **fail-closed** until durable journal, evidence grounding, and narrow profile acceptance qualify (ZA-17 → ZA-20). A host OpenCode key alone does **not** admit the surface; Worlds UI remains usable while Eve routes return explicit `Blocked` / unavailable.

## Voice (`eve-web-speech-v1`)

Browser **Web Speech API** surface for Eve (ZN-0063 / EX44):

- STT: `SpeechRecognition` / `webkitSpeechRecognition` → transcript
- Text turn: transcript enters the Eve journal + OpenCode Zen completion path **when admitted**
- TTS: `speechSynthesis` speaks the settled reply

Not a stub. Not cloud STT/TTS (no OpenAI/ElevenLabs keys present; OpenCode Zen has zero voice models). Fail-closed when the browser APIs are missing **or** when product Eve is unadmitted. Profile/admission are separate from text Zen (`web-speech` vs `opencode-zen`).
