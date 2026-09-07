# D05 — Eve com evidência e continuidade (contrato candidato)

Status: candidato. Congelamento mínimo executável em `docs/contracts/eve-freeze.md`. Entrega estrutural em `planning/deliveries.json` (`D05`, fase P2): conversar com fatos, incerteza, cancelamento e journal recuperável; voz browser via Web Speech.

## Resultado dos incrementos EX40–EX44

1. Congelar F01–F09 (texto grounded, journal recuperável; OpenCode Zen free texto; Web Speech voz).
2. Schemas/ports puros sob `eve/**` (conversation, turn, journal, evidence links; perfis stub + Zen + Web Speech).
3. Prova local de recoverability do journal **e** caminho produto accept → Zen → settle.
4. Qualificação ZN-0063 OpenCode Zen free em `docs/verification/eve-opencode-zen.md`.
5. Qualificação ZN-0063 voz Web Speech em `docs/verification/eve-web-speech.md` (transcript → turn texto → TTS).

## Fora de escopo deste incremento

- Cloud STT/TTS (sem keys; não inventar).
- Processo runtime separado `packages/eve`.
- Cutover do app legado `zoen`.
- D05 integral / aceitação ZN-0281.
- Streaming provisório de produção / tool dispatch completo.

## EX40 (freeze + schemas)

Freeze F01–F09 + schemas wire `eve.v1` em `packages/contracts/src/eve/**` (perfis stub + Zen + Web Speech).

## EX41 (journal)

Porta `EveJournal` em `packages/authority/src/ports/eve/**`: accept → cancel/settle → recover; `voice-blocked` / unqualified real-model fail-closed `Blocked`; `web-speech` admitido.

## EX42 (OpenCode Zen client)

Client OpenAI-compatible com headers free-tier; key só via env/Fly secret.

## EX43 (turn path + qualificação Zen)

`runEveTurn`: accept → model → settle; cancel/abort antes de settle; artefato `docs/verification/eve-opencode-zen.md`.

## EX44 (voice Web Speech + HTTP/CLI surface)

`runEveVoiceTurn` + `@zoen/web` Web Speech adapter; artefato `docs/verification/eve-web-speech.md`.

Rotas `/api/eve/execute` + CLI `eve-turn`/`eve-cancel`/`eve-recover` no path OpenCode Zen. Stub não é default de produto; sem key → Blocked. Ver `docs/verification/eve-http-surface.md`.
