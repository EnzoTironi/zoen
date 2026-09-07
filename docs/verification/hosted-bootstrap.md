# Hosted bootstrap inventory (D04 / EX35)

Data: 2026-09-06 (PT). Tip de partida: `bb608c4`.

## Presente

- Fly auth: yes (`fly auth whoami` → signed-in personal org).
- Dockerfile de aplicação: `ops/containers/application.Dockerfile`.
- Compose local PG/S3: `ops/compose.yaml`.
- All-in-one: `ops/fly/fly.toml`, `ops/fly/README.md`, `ops/containers/all-in-one.Dockerfile` (PG+RustFS+app; sem MPG/Tigris).

## Hosted persistence (decisão)

- **All-in-one VM** com volume único — **não** MPG, **não** Tigris (rejeitados).
- App Fly `zoen-rebuild` **live** all-in-one (PG+RustFS+app no volume, `min_machines_running=1`, https://zoen-rebuild.fly.dev); secrets incluem `ZOEN_OPENCODE_*`.
- Secret mínimo esperado: `ZOEN_AUTH_SECRET`; URLs DB/S3 loopback no container/volume.
- App legado `zoen` não é evidência do monólito modular (topologia/segredos distintos; sem cutover).

## Não alegado

- D03 integral, restore-após-erasure, cutover, D04 `activated` / `verified_for_profile` de operação hosted.

## EX36 schemas

- `packages/contracts/src/hosted/policy/values.ts` — `d04-hosted-retained-v1`
- `packages/authority/src/ports/hosted/policy.ts` + união em `ports/d01/context.ts`
- Unidade: `*.EX36.test.ts` sob contracts/authority `hosted/policy`
- Composition default permanece local retained; sem `fly deploy`

## EX37 disposable restore

- Harness: `tests/integration/hosted/restore/**` (pg_dump→restore descartável + escopo hosted-only + S3 marker)
- Doc: `docs/verification/hosted-retained-restore.md`
- Prova só escopo `d04-hosted-retained-v1`; sem rebind local; `restoreAfterErasure` fechado; sem Fly/MPG/Tigris

## EX38 admission flags

- Contracts: `packages/contracts/src/hosted/admission/values.ts` — `d04HostedRetainedAdmissionFlags`
- Authority: `packages/authority/src/hosted/admission/flags.ts` — readiness + `requireAdmittedCapability` / channel fail-closed
- Unidade: `packages/authority/test/hosted/admission/flags.EX38.test.ts`
- Núcleo web/cli/file ready; canais/providers disabled/Blocked; provider ausente não passa readiness de canal; sem Fly deploy

## EX39 compose/verify (local only)

- Provision: `ops/local/world-policy.ts` + `ZOEN_LOCAL_WORLD_POLICY=d04-hosted-retained-v1` (NEW installs)
- Composition: `hostedAdmissionLayerFor` → `HostedAdmissionFlags` when hosted policy
- Doc: `docs/verification/hosted-local.md`
- Independent: `tests/integration/hosted/independent/**`
- `ops/fly/**` all-in-one; **sem** MPG/Tigris
- `verified_for_profile` **somente** bootstrap local hosted-retained (EX35–EX39) — app Fly live não marca D04 `activated` / piloto sensível / cutover
