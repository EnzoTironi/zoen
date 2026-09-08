# Eve Web Speech voice — ZA-21 / ZN-0063

Data: 2026-09-08 (PT). Tip de partida: `2a7bda6` (ZA-20 #108). Perfil I/O voz: `eve-web-speech-v1` / admission `web-speech`. Turno de texto admitido: `eve-opencode-zen-v1` / `opencode-zen` (ZA-20). Cloud STT/TTS: **desabilitado** (`CLOUD_SPEECH_ENABLED = false`).

## Problema que este ticket fecha

Presença de constructors Web Speech / probes headless **não** equivalem a I/O de voz autorizado. ZA-21 qualifica o **adapter opcional** browser: gesto explícito → transcript revisável → **mesmo** text turn → fala só do settled autorizado — sem captura contínua em background e sem cloud speech.

## Inventário de providers (sem inventar)

| Fonte | Voz / TTS / STT? |
| --- | --- |
| OpenCode Zen catalog | **Zero** voice/tts/whisper models |
| `.local/opencode.env` key names | `OPENCODE_API_KEY`, `ZOEN_OPENCODE_*` only |
| Fly secrets (`zoen-rebuild`) | `ZOEN_AUTH_SECRET`, `ZOEN_S3_*`, `ZOEN_OPENCODE_*` — **no** OpenAI/ElevenLabs/Deepgram |
| Browser Web Speech API | Platform STT+TTS — optional I/O adapter |
| Cloud STT/TTS product path | **Disabled** — sem implementação neste incremento |

## Fluxo (ZA-21)

1. Controlo visível `start-speech` (gesto explícito) → one-shot `SpeechRecognition` (`continuous = false`)
2. Fase `reviewing`: utilizador inspeciona/corrige transcript (input de utilizador, **não** evidência de domínio)
3. `confirm-transcript` → `AcceptConversationTurn` com `eve-opencode-zen-v1` / `opencode-zen` (mesmo text turn ZA-20)
4. Só `phase === Settled` + `visibleText` não-vazio → `speechSynthesis` (controlo `stop-speech`)
5. `cancel` / revoke a qualquer momento: pára recognition/TTS; **não** settle mensagens adicionais não autorizadas

Mudar de canal **não** concede autoridade extra (`grantsExtraAuthority: false`).

## Acceptance

| ID | Automação | Resultado |
| --- | --- | --- |
| ZA-21-01 | Unit session + text-turn request shape | Transcript→text turn→settled→speak + controlos visíveis (`voice-session.ZA21.test.ts`) |
| ZA-21-02 | Unit unsupported + mic denied | Sem listener oculto, sem transcript fabricado; text turn continua utilizável |
| ZA-21-03 | Unit cancel during recognition/speech | Para no boundary; sem settle adicional após cancel |

**Real device / mic / audible playback:** ver matriz abaixo — **Blocked** para qualificação de produto até evidência de operador em browser/dispositivo suportado. Fake recognition callbacks nos unit tests **não** contam como G-PROVIDER / device qualification.

## Matriz de suporte (registada; sem skip-as-pass)

| Ambiente | SpeechRecognition | speechSynthesis | Mic permission | Audible TTS | Qualificação |
| --- | --- | --- | --- | --- | --- |
| Node unit host | false | false | n/a | n/a | Fail-closed proofs **green** |
| Injected fake recognition (unit) | simulated | simulated | simulated | n/a | Adapter state machine only — **not** device qualification |
| Playwright Chromium headless (histórico EX44) | constructors often true | speak queue may accept | OS/session | not claimed | API presence ≠ audio success |
| Supported desktop browser + real mic (manual) | required | required | user gesture | required | **Blocked / pending operator evidence** |
| Unsupported browser / denied mic | absent or denied | any | denied | n/a | Voice unavailable; text usable (ZA-21-02) |
| Cloud STT/TTS | n/a | n/a | n/a | n/a | **Disabled** — never activated by this PR |

## Fail-closed / não alegado

- Product Eve / G-PROVIDER permanecem fail-closed; este PR **não** ativa Eve nem cloud speech.
- Tip mantém text profile gate fechado sem prova live (ZA-20).
- Sem continuous listening, phone-call integration, ou claim de suporte universal de browser.
- Sem D05 integral / processo Eve separado / cutover legado.

## Comandos

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm exec vitest run --project unit \
  apps/web/test/features/eve/web-speech.EX44.test.ts \
  apps/web/test/features/eve/voice-session.ZA21.test.ts \
  apps/web/test/features/eve/browser-voice.ZA21.test.ts
pnpm build
```

Manual (operador; não CI):

1. Browser suportado com Web Speech + mic permitido
2. Abrir superfície Eve (quando admitida), `start-speech`, corrigir transcript, confirmar
3. Ouvir settled reply; cancelar a meio da fala e confirmar que TTS pára
4. Negar mic / browser sem API → voice unavailable, texto ainda funciona
5. Anexar evidência (browser/OS/versão, permissão, resultado) a este doc — até lá: **Blocked** para device speech

## INV-01

Journal snapshots continuam com `authorityCredentialPresent: false`; transcript e prompts nunca recebem API keys OpenCode.
