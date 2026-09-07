# D05 — Eve com evidência e continuidade (contrato candidato)

Status: candidato. Congelamento mínimo executável em `docs/contracts/eve-freeze.md`. Entrega estrutural em `planning/deliveries.json` (`D05`, fase P2): conversar com fatos, incerteza, cancelamento e journal recuperável; voz como incremento.

## Resultado dos incrementos EX40–EX43

1. Congelar F01–F09 (texto grounded, journal recuperável, voz bloqueada; OpenCode Zen free admitido com key).
2. Schemas/ports puros sob `eve/**` (conversation, turn, journal, evidence links; perfis stub + `eve-opencode-zen-v1`).
3. Prova local de recoverability do journal **e** caminho produto accept → Zen → settle.
4. Qualificação ZN-0063 OpenCode Zen free em `docs/verification/eve-opencode-zen.md`.
5. Voz permanece explicitamente bloqueada (nunca mock-saudável).

## Fora de escopo deste incremento

- Voz / transcript como autorização.
- Processo runtime separado `packages/eve`.
- Cutover do app legado `zoen`.
- D05 integral / aceitação ZN-0281.
- Streaming provisório de produção / tool dispatch completo.

## EX40 (freeze + schemas)

Freeze F01–F09 + schemas wire `eve.v1` em `packages/contracts/src/eve/**` (perfis stub + Zen).

## EX41 (journal)

Porta `EveJournal` em `packages/authority/src/ports/eve/**`: accept → cancel/settle → recover; voice/unqualified real-model fail-closed `Blocked`.

## EX42 (OpenCode Zen client)

Client OpenAI-compatible com headers free-tier; key só via env/Fly secret.

## EX43 (turn path + qualificação)

`runEveTurn`: accept → model → settle; cancel/abort antes de settle; artefato `docs/verification/eve-opencode-zen.md`.
