# Eve Web Speech voice — qualificação ZN-0063 (D05 / EX44)

Data: 2026-09-07 (PT). Tip de partida: `daabe8e`. Tip verificado: `663b1d9` (`663b1d9488b105dd5b8b1e75c61c589a13c7976b`). Perfil produto voz: `eve-web-speech-v1` / admission `web-speech`. Texto permanece `eve-opencode-zen-v1` / `opencode-zen`.

## Inventário de providers (sem inventar)

| Fonte | Voz / TTS / STT? |
| --- | --- |
| OpenCode Zen catalog | **Zero** voice/tts/whisper models (steering 2026-09-07) |
| `.local/opencode.env` key names | `OPENCODE_API_KEY`, `ZOEN_OPENCODE_*` only |
| Fly secrets (`zoen-rebuild`) | `ZOEN_AUTH_SECRET`, `ZOEN_S3_*`, `ZOEN_OPENCODE_*` — **no** OpenAI/ElevenLabs/Deepgram |
| Browser Web Speech API | **Real** platform STT+TTS — admitted |

## Escopo verificado

| Item | Estado |
| --- | --- |
| Freeze F05/F07 (Web Speech voice; Zen text) | Landed — `docs/contracts/eve-freeze.md` |
| Schemas `eve-web-speech-v1` / `web-speech` + capabilities | Landed — `packages/contracts/src/eve/**` |
| Probe puro + `runEveVoiceTurn` (transcript → Zen settle → speakText) | Landed — `packages/ontology/src/ports/eve/voice.ts` |
| `@zoen/web` STT/TTS adapter | Landed — `apps/web/src/features/eve/**` |
| Cloud STT/TTS | **Não** — sem keys; não inventado |
| D05 integral / processo Eve separado | **Não** alegado |

## Fluxo

1. Browser `SpeechRecognition` → transcript
2. `runEveVoiceTurn` exige recognition; journal admission `web-speech` / profile `eve-web-speech-v1`
3. Turn path chama OpenCode Zen **texto** (mesma completion EX43) com transcript como `userText`
4. Settled `visibleText` → `speakText` / browser `speechSynthesis`

Direção: **bidirecional** (STT + TTS) quando ambos os constructors existem. Fail-closed se recognition ausente.

## Comandos

Unit:

```bash
pnpm exec vitest run --project unit \
  packages/contracts/test/eve \
  packages/ontology/test/ports/eve \
  apps/web/test/features/eve
```

Browser probe (disposable; Playwright Chromium):

```bash
pnpm exec node .local/eve-web-speech-probe.mjs
```

Plan structural check:

```bash
python3 tooling/verify_plan.py
```

## Live browser evidence observed (2026-09-07 PT)

Host: Playwright Chromium headless on maintainer Mac (`HeadlessChrome/153.0.8010.12`).

| Field | Observed |
| --- | --- |
| `SpeechRecognition` | true |
| `webkitSpeechRecognition` | true |
| `speechSynthesis.speak` | true |
| `speakQueued` (`SpeechSynthesisUtterance("eve-ok")` + cancel) | true |
| `speakError` | null |
| Node unit host (no Web Speech) | recognition/synthesis **false** — fail-closed proofs green |

Notes: headless Chromium exposes constructors; microphone permission / audible playback are OS/session concerns and are **not** claimed as CI-green audio. Qualification records API presence + speak queue accept, plus unit fail-closed on Node.

## INV-01

Voice turn journal snapshots set `authorityCredentialPresent: false` and never store OpenCode API keys (same as EX43).

## Não alegado

- Cloud STT/TTS keys or providers.
- Production mic permission UX / continuous listening / barge-in.
- Separate Eve process / Fly redeploy / legacy `zoen` cutover.
- Full D05 / ZN-0281 acceptance.
