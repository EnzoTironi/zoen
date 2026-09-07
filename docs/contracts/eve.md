# D05 — Eve com evidência e continuidade (contrato candidato)

Status: candidato. Congelamento mínimo executável em `docs/contracts/eve-freeze.md`. Entrega estrutural em `planning/deliveries.json` (`D05`, fase P2): conversar com fatos, incerteza, cancelamento e journal recuperável; voz como incremento.

## Resultado do incremento EX40+

1. Congelar F01–F09 (texto grounded, journal recuperável, voz/modelo real bloqueados).
2. Schemas/ports puros sob `eve/**` (conversation, turn, journal, evidence links).
3. Prova local stub de recoverability do journal **sem** LLM ao vivo.
4. Manter provider real e voz explicitamente bloqueados (nunca mock-saudáveis).

## Fora de escopo deste incremento

- Ativação de modelo/API/conta real e spend de LLM.
- Voz / transcript como autorização.
- Processo runtime separado `packages/eve`.
- Redeploy Fly ou cutover do app legado `zoen`.
- D05 integral / aceitação ZN-0281.

## EX40 (freeze + schemas)

Freeze F01–F09 + schemas wire `eve.v1` / perfil `eve-local-stub-v1` em `packages/contracts/src/eve/**`. Sem wire de composição de servidor; sem DataPolicy rebind.

## EX41 (journal stub)

Porta `EveJournal` em `packages/authority/src/ports/eve/**` com layer in-memory descartável: accept → cancel/settle → recover preserva ordem; real-model e voice fail-closed `Blocked`.
