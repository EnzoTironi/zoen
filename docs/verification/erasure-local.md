# Erasure — evidência local (EX30–EX34)

Em 2026-09-06 (PT), o **congelamento mínimo** de erasure está em [`docs/contracts/d03-erasure-freeze.md`](../contracts/d03-erasure-freeze.md). Schemas `erasure.v1` e a porta `ErasureAttemptRegister` existem como contrato/interface. EX31 adiciona um registro local durável em schema isolado `erasure_attempt`.

## Estado honesto

| Item | Estado |
| --- | --- |
| Freeze F01–F09 | Landed |
| Schemas Request/Inspect | Landed (unidade EX30) |
| Porta de registro | Interface + unqualified oracle Unavailable + **local PG adapter** (`erasure_attempt`) |
| Durabilidade do registro | Linhas em `erasure_attempt.attempts` com digest de intenção; commit fora da unidade `authority.*` (schema separado; testes usam DB descartável) |
| Closing local (EX32) | Planejado — não implementado neste tip |
| Web/CLI (EX33) | Planejado |
| Purge / Erased | **Bloqueado** (controlador, backups, Object Lock, fencing World) |
| restoreAfterErasure | **false** / fechado |

Worlds `d01-local-retained-v1` continuam sem erasure. Perfil candidato `d03-local-erasable-v1` só para Worlds **novos** após EX34 e gates.

## EX31 — o que foi provado

- `register` → `Registered`; replay idêntico é idempotente.
- Mesma identidade com payload/digest diferente → `Conflict`.
- `mirrorLocalOutcome` é exclusivo (`Confirmed` ⟂ `Aborted`); espelho contraditório → `Conflict`.
- Registrar **não** muta `authority.worlds` (probe); rollback de tx de autoridade não apaga a linha do registro.
- `Registered` / `Unknown` bloqueiam ativação (`blocksWorldActivation`); registro ≠ Closing.

DDL candidata: `packages/authority/src/ports/erasure/schema.sql` (e espelho em `local-pg.ts`). Numeração em `ops/migrations/**` permanece do root.

## Lacunas de qualificação (ainda bloqueiam controlador/Closing de produção)

- Topologia de serviço controlador distinto (epochs, grants, âncora anti-rollback independente).
- Mesmo host PostgreSQL de compose **não** é controlador qualificado; schema separado é unidade de rollback de aplicação, não isolamento de cluster/backup.
- Sem admissão de Object Lock / catálogo de cópias / fence World (ER-R02).
- Closing local (EX32) ainda não observa o registro no executor semântico.

Isto **não** marca erasure `verified_for_profile` e **não** autoriza apagar dados reais.
