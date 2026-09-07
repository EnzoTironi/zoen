# Hosted retained — evidência local composta (EX35–EX39)

Em 2026-09-06 (PT), tip verificado: `7e91940` (`7e9194024a551f2ba99faf00d726b4bb465dc020`). O incremento **D04 hosted-retained bootstrap local** (EX35–EX39) está composto e marcado **`verified_for_profile` apenas para bootstrap local hosted-retained** (schemas + restore disposable + admission flags + compose/provision stubs) — **não** D04 ativado / piloto sensível / cutover (app Fly all-in-one já live; ver secção abaixo).

## Estado honesto

| Item | Estado |
| --- | --- |
| Freeze H01–H08 | Landed (EX35) |
| Schemas `d04-hosted-retained-v1` | Landed (EX36); união `DataPolicySchema` |
| Restore disposable escopo retained | Landed (EX37); compose PG/S3 local |
| Admission flags (H06 / ZN-0288) | Landed (EX38); web/cli/file ready; canais/providers disabled/Blocked |
| Compose/provision local (EX39) | Landed — perfil hosted só em **Worlds novos** via `ZOEN_LOCAL_WORLD_POLICY`; retained default |
| `ops/fly/**` | All-in-one VM **live** (PG+RustFS+app no volume, `min_machines_running=1`, https://zoen-rebuild.fly.dev); **sem** MPG/Tigris |
| D04 ativado / cutover `zoen` | **Não** |
| D03 purge / restore-após-erasure | **Bloqueado** |

Default de composition/provision permanece `d01-local-retained-v1`. Perfil candidato `d04-hosted-retained-v1` só via provisionamento explícito de instalação **nova**. Sem rebind/migração de Worlds `d01-*` / `d03-*` (H01).

## Provisionamento local (EX39)

```bash
# Default — local retained (sem hosted)
ZOEN_LOCAL_PROFILE=application pnpm provision:local

# Novo install hosted-retained (Worlds novos sob d04-hosted-retained-v1)
# Stand-in local; NÃO é deploy Fly.
ZOEN_LOCAL_PROFILE=hosted-retained-v1 \
  ZOEN_LOCAL_PUBLIC_URL=http://127.0.0.1:4322 \
  ZOEN_LOCAL_WORLD_POLICY=d04-hosted-retained-v1 \
  pnpm provision:local
```

`resolveLocalWorldPolicy` (`ops/local/world-policy.ts`) admite retained / erasable / hosted-retained. Composition (`hostedAdmissionLayerFor`) injeta `HostedAdmissionFlags` **somente** quando a policy do install é `d04-hosted-retained-v1`.

## EX39 — o que o compose/verify garante

- Provision/local policy helper + composition admission layer.
- Oráculos independentes: novo World hosted carimba `d04-hosted-retained-v1`; retained default distinto; core surfaces ready; WhatsApp/providers Blocked; stubs Fly presentes e proíbem gasto.
- Evidência separa **bootstrap local verificado** (EX35–EX39) de **D04 ativado / piloto sensível / cutover** (ainda não).

## Suite

```bash
pnpm format:check && pnpm lint && pnpm typecheck
pnpm exec vitest run --project unit ops/local/world-policy.test.ts \
  packages/contracts/test/hosted packages/authority/test/hosted \
  packages/authority/test/ports/hosted
pnpm exec vitest run --project integration \
  tests/integration/hosted/independent \
  tests/integration/hosted/restore
python3 tooling/verify_plan.py
```

## Hosted path: all-in-one VM (live)

Enzo rejeitou Managed Postgres e Managed S3/Tigris. Persistência = **volume único** na VM. **Estado atual (2026-09-07 PT):** app **`zoen-rebuild` live** all-in-one (`min_machines_running=1`, https://zoen-rebuild.fly.dev); secrets incluem `ZOEN_AUTH_SECRET` e `ZOEN_OPENCODE_*`. MPG/Tigris destruídos por desenho — **não reviver**.

1. App Fly `zoen-rebuild` — live (all-in-one).
2. Volume `zoen_data` montado em `/data` — PG + object bytes.
3. Imagem `ops/containers/all-in-one.Dockerfile` (Postgres + RustFS + server).
4. Secrets via `fly secrets` (DB/S3 loopback no `[env]` / volume; OpenCode Zen keys quando Eve live).
5. Redeploy: `fly deploy -a zoen-rebuild --config ops/fly/fly.toml --dockerfile ops/containers/all-in-one.Dockerfile`
6. Prova: `fly status` + `curl https://zoen-rebuild.fly.dev/ready`.
7. **Não** recriar MPG/Tigris; **não** cutover do legado `zoen` sem decisão explícita.
8. Gaps restantes: catálogo de backup (restore admitido além do disposable); piloto **sensível** (D03 purge + restore-após-erasure / ZN-0116 ainda blocked).

## Não alegado

- D04 `activated` / piloto sensível completo.
- Cutover do app `zoen` / DNS `zoen.tironi.xyz`.
- MPG/Tigris (rejeitados; all-in-one substitui).
- WhatsApp real ou providers saudáveis.
- ZN-0116 / restore-após-erasure.
