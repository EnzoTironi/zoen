# Hosted admission flags (D04 / EX38)

Data: 2026-09-06 (PT). Freeze H06 / ZN-0288.

## Escopo

Perfil `d04-hosted-retained-v1` declara admission flags honestos: só superfícies D01 `web` / `cli` / `file` ficam `admitted`→readiness `ready`. Canais e providers não provisionados (`whatsapp`, `telegram`, `oauth`, `model`, `feed`, `gpu`, `broker`, `custodian`) permanecem `disabled` e enforcement retorna `Blocked` — nunca `healthy` falso.

## Provas

- Unidade: `packages/authority/test/hosted/admission/flags.EX38.test.ts`
- Matriz disabled vs enabled; negativo provider ausente / canal não qualificado

## Não alegado

- D04 ativado, Fly deploy/MPG/Tigris, cutover do app `zoen`, WhatsApp real, restore-após-erasure
