# Hosted admission flags (D04 / EX38)

Data: 2026-09-06 (PT). Freeze H06 / ZN-0288.

## Escopo

Perfil `d04-hosted-retained-v1` declara admission flags honestos: só superfícies D01 `web` / `cli` / `file` ficam `admitted`→readiness `ready`. Canais e providers não provisionados (`whatsapp`, `telegram`, `oauth`, `model`, `feed`, `gpu`, `broker`, `custodian`) permanecem `disabled` e enforcement retorna `Blocked` — nunca `healthy` falso.

## Provas

- Unidade: `packages/ontology/test/hosted/admission/flags.EX38.test.ts`
- Matriz disabled vs enabled; negativo provider ausente / canal não qualificado

## Não alegado

- D04 ativado, cutover do app `zoen`, WhatsApp real, restore-após-erasure; MPG/Tigris rejeitados (all-in-one)
