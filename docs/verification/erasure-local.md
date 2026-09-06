# Erasure — evidência local (EX30–EX34)

Em 2026-09-06 (PT), o **congelamento mínimo** de erasure está em [`docs/contracts/d03-erasure-freeze.md`](../contracts/d03-erasure-freeze.md). Schemas `erasure.v1`, a porta `ErasureAttemptRegister` e o **Closing local** (EX32) existem neste tip.

## Estado honesto

| Item | Estado |
| --- | --- |
| Freeze F01–F09 | Landed |
| Schemas Request/Inspect | Landed (unidade EX30) |
| Porta de registro | Interface + unqualified oracle Unavailable + **local PG adapter** (`erasure_attempt`) |
| Durabilidade do registro | Linhas em `erasure_attempt.attempts` com digest de intenção; commit fora da unidade `authority.*` (schema separado; testes usam DB descartável / pool dedicado) |
| Closing local (EX32) | **Landed** — `RequestWorldErasure` / `InspectWorldErasure` no executor semântico; Active→Closing com receipt+outbox; sucesso só após Confirmada |
| Web/CLI (EX33) | Planejado |
| Purge / Erased | **Bloqueado** (controlador, backups, Object Lock, fencing World) |
| restoreAfterErasure | **false** / fechado |

Worlds `d01-local-retained-v1` continuam sem erasure. Perfil candidato `d03-local-erasable-v1` é suportado como `DataPolicy` union para Worlds **novos**; composição default permanece retained até EX34.

## EX31 — o que foi provado

- `register` → `Registered`; replay idêntico é idempotente.
- Mesma identidade com payload/digest diferente → `Conflict`.
- `mirrorLocalOutcome` é exclusivo (`Confirmed` ⟂ `Aborted`); espelho contraditório → `Conflict`.
- Registrar **não** muta `authority.worlds` (probe); rollback de tx de autoridade não apaga a linha do registro.
- `Registered` / `Unknown` bloqueiam ativação (`blocksWorldActivation`); registro ≠ Closing.

## EX32 — o que Closing garante

- Registro externo observado (`Registered`) **antes** do commit local (F01).
- Commit atômico: progresso `Closing` + receipt imutável de erasure + `jobs.outbox` + `authority.operations` (F05/F08).
- Espelho `Confirmed` no registro **depois** do commit; HTTP/resultado de sucesso só com Confirmada observada.
- Replay idempotente do mesmo `operationId` reautoriza e re-exige Confirmada.
- Payload conflitante → `Conflict`; perfil retained → `PROFILE_BLOCKED`; registro unqualified/Unavailable → sem progresso local.
- World entra em **Closing** sem reivindicar `Erased` / `Purging` / DELETE S3.

DDL candidata: `packages/authority/src/ports/erasure/schema.sql` + `packages/authority/src/knowledge/erasure/schema.sql`. Numeração em `ops/migrations/**` permanece do root.

## Lacunas (bloqueiam EX33/EX34 / purge)

- Topologia de controlador distinto (epochs, grants, âncora anti-rollback independente).
- Mesmo host PostgreSQL de compose **não** é controlador qualificado.
- Sem admissão de Object Lock / catálogo de cópias / fence World (ER-R02).
- EX33 Web/CLI confirmação explícita ainda não implementada.
- EX34 compose/verify do perfil erasable em Worlds novos; sem rebind de Worlds retidos.
- Purge SQL/S3 e transição Closing→Erased bloqueados.

Isto **não** marca erasure `verified_for_profile` e **não** autoriza apagar dados reais.
