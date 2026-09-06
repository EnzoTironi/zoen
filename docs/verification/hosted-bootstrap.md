# Hosted bootstrap inventory (D04 / EX35)

Data: 2026-09-06 (PT). Tip de partida: `bb608c4`.

## Presente

- Fly auth: yes (`fly auth whoami` → signed-in personal org).
- Dockerfile de aplicação: `ops/containers/application.Dockerfile`.
- Compose local PG/S3: `ops/compose.yaml`.
- Stubs: `ops/fly/fly.toml`, `ops/fly/README.md` (sem `fly deploy`).

## Ausente / bloqueadores para deploy

- App Fly `zoen-rebuild` não criado (proposital; evita gasto).
- Sem Fly Managed Postgres / Tigris na org no inventário desta data.
- Secrets do redesign não provisionados no Fly.
- App legado `zoen` não é evidência do monólito modular (topologia/segredos distintos; check critical).

## Não alegado

- D03 integral, restore-após-erasure, cutover, D04 `activated` / `verified_for_profile` de operação hosted.
