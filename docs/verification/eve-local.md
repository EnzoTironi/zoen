# Eve local stub — evidência do primeiro incremento (EX40–EX41)

Data: 2026-09-07 (PT). Tip de partida: `644d400`. Tip verificado stub: `3d2e71c`.

**Nota:** o path de **produto** passou a ser OpenCode Zen free (`eve-opencode-zen-v1`) — ver `docs/verification/eve-opencode-zen.md`. Este arquivo permanece como evidência do stub offline (unit proofs only).

## Escopo verificado (stub)

| Item | Estado |
| --- | --- |
| Freeze F01–F09 | Landed (EX40) — `docs/contracts/eve-freeze.md` |
| Schemas `eve.v1` / `eve-local-stub-v1` | Landed (EX40) — offline proofs only |
| Journal port + recoverability stub | Landed (EX41) — in-memory |
| Modelo real / OpenCode Zen | Ver `eve-opencode-zen.md` (EX42–EX43) |
| Voz | Ver `eve-web-speech.md` (EX44) |
| D05 integral | **Não** alegado |

## Comandos

```bash
pnpm exec vitest run --project unit \
  packages/contracts/test/eve \
  packages/authority/test/ports/eve
```

## Não alegado

- Stub como path de produto (substituído por Zen quando key presente).
- Cloud STT/TTS / streaming prod / processo Eve separado / cutover `zoen` (Web Speech: ver `eve-web-speech.md`).
