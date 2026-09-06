# Hosted retained — disposable restore proof (EX37)

Em 2026-09-06 (PT), o incremento **EX37** prova backup→restore **descartável** do escopo retained habilitado do perfil candidato `d04-hosted-retained-v1`, em Postgres/S3 locais (compose). Isto **não** marca D04 ativado, **não** faz deploy Fly, **não** provisiona MPG/Tigris, **não** cutover do app legado `zoen` e **não** alega ZN-0116 / restore-após-erasure.

## O que foi provado

| Oráculo | Resultado |
| --- | --- |
| Dump lógico `pg_dump` → restore em DB descartável | World `d04-hosted-retained-v1` reaparece com o mesmo `data_policy_id`; destino dropado após a prova |
| Acesso pós-restore sob política hosted | `authorizeWorld` succede com `d04-hosted-retained-v1` |
| Sem rebind do default local | Mesmo World sob `d01-local-retained-v1` → `PROFILE_BLOCKED` |
| Escopo só retained habilitado | Restore/cópia filtrada **não** divulga World `d01-local-retained-v1` vizinho |
| Gates de erasure | `erasure:false`, `restoreAfterErasure:false` (ausência de ledger ≠ erasure) |
| S3 disposable | Put → copy-backup → delete → restore-copy → get; chave fora do escopo permanece ausente |

Evidência de código: `tests/integration/hosted/restore/**` (harness `dump-restore.ts` via `docker compose` + Postgres do `ops/compose.yaml`).

## O que NÃO foi alegado

- Catálogo de backup hospedado / RPO/RTO / restore online de produção
- Fly app `zoen-rebuild`, Managed Postgres, Tigris, secrets managed
- Cutover DNS/`zoen` legado
- D03 purge, fencing ER-R02, ou restore-após-erasure (ZN-0116)
- Rebind/migração de Worlds `d01-*` / `d03-*` existentes

## Como reproduzir

```bash
# compose PG + RustFS já saudáveis; .env.infra carregado
pnpm test:integration -- tests/integration/hosted/restore
```

`execution.json` permanece `planned` / `not_run` para `verify_plan`; o progresso honesto fica em `planning/progress.json`.
