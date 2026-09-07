# Erasure — evidência local (EX30–EX34)

Em 2026-09-06 (PT), o **congelamento mínimo** de erasure está em [`docs/contracts/d03-erasure-freeze.md`](../contracts/d03-erasure-freeze.md). O incremento **Closing/register local** (EX30–EX34) está composto e marcado **`verified_for_profile` apenas para a superfície local Closing/register** — **não** D03 integral.

- Tip verificado: `66b958b` (`66b958b84684ba080fdaacf2360f05e511d3d68c`).

## Estado honesto

| Item | Estado |
| --- | --- |
| Freeze F01–F09 | Landed |
| Schemas Request/Inspect | Landed (EX30) |
| Porta de registro | Interface + unqualified oracle + **local PG adapter** (`erasure_attempt`) |
| Migrações numeradas | `009_erasure_attempt_register.sql` + `010_world_erasure_closing.sql` + grants |
| Closing local (EX32) | Landed — Active→Closing com receipt+outbox; sucesso só após Confirmada |
| Web/CLI (EX33) | Landed — `/api/erasure/execute`, CLI `--confirm-entire-world`, painel owner-only |
| Compose/verify (EX34) | Landed — perfil `d03-local-erasable-v1` só em **Worlds novos**; retained default |
| Purge / Erased (local controlled copies) | **Landed EX45** — Closing→Erased via `PurgeWorldContent` (SQL + World object prefix; EX44 ports). AttestationScope=`local-controlled-copies`. |
| Full D03 Erased (controller/backups/fence/Fly) | **Bloqueado** |
| Object Lock / retention (RustFS local) | **Qualificado** — `docs/verification/erasure-storage-qualification.md` |
| restoreAfterErasure | **false** / fechado |

Worlds `worlds-local-retained-v1` continuam **sem** erasure. Perfil candidato `d03-local-erasable-v1` só via provisionamento explícito de instalação **nova** (`ZOEN_LOCAL_WORLD_POLICY=d03-local-erasable-v1`). Sem rebind/migração de Worlds retidos (F02).

## Provisionamento local (EX34)

```bash
# Default — retained (sem erasure)
ZOEN_LOCAL_PROFILE=application pnpm provision:local

# Novo install erasable (Worlds novos sob d03-local-erasable-v1)
ZOEN_LOCAL_PROFILE=erasable-v1 \
  ZOEN_LOCAL_PUBLIC_URL=http://127.0.0.1:4321 \
  ZOEN_LOCAL_WORLD_POLICY=d03-local-erasable-v1 \
  pnpm provision:local
```

`applyErasureMigrations` instala DDL 009/010 em qualquer install novo; a **política** no `installation.json` decide se Worlds nascem retained ou erasable. Retained permanece o default de compose.

## EX31–EX33 — o que foi provado

- Registro externo idempotente; Conflict de payload; Confirmed ⟂ Aborted.
- Closing só após Registered; sucesso só com Confirmada; retained → `PROFILE_BLOCKED`.
- Web/CLI: owner confirma Closing; viewer negado; replay imutável; sem UI de purge/restore.

## EX34 — o que o compose/verify garante

- Migrações numeradas + grants para `erasure_attempt` e progresso/receipt locais.
- Oráculos independentes: novo World erasable fecha em Closing; retained rejeita; `restoreAfterErasure:false`.
- Fixtures de executor legados fornecem `ErasureAttemptRegister.unqualifiedLayer` (dívida EX33 de typecheck).
- Evidência separa **Closing/register verificado** de **purge ainda bloqueado**.

## EX45 — Closing→Erased (local controlled copies)

- Tip: see `planning/progress.json` EX45 checkpoint.
- `PurgeWorldContent` after Closing+Confirmada: Purging→Erased; SQL content FK-safe delete; S3 World-prefix via EX44 ports; `restoreAfterErasure:false`; Closing receipt immutable on replay.
- Attestation is **only** `local-controlled-copies`.

## Lacunas (bloqueiam D03 integral)

- Controlador distinto no Fly all-in-one (epochs, grants, âncora anti-rollback independente do volume único).
- Catálogo de backups/cópias.
- Fence World (ER-R02); restore online (ER-R03) permanece fechado (F04).
- Catálogo de backups/cópias; controlador/anti-rollback; ER-R02; Fly re-probe; forensic wipe.
- Re-prova Object Lock na VM Fly live.

Cleared localmente (2026-09-07): Object Lock/retention/hold no RustFS compose; `ErasureObjectInventory` + `ErasurePurgeStore`; provision erasable com Object Lock.

Isto **não** marca D03 completo nem autoriza Erased em produção.
