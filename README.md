# Zoen

[![Verify](https://github.com/EnzoTironi/zoen/actions/workflows/verify.yml/badge.svg)](https://github.com/EnzoTironi/zoen/actions/workflows/verify.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) [![Node.js](https://img.shields.io/badge/Node.js-24-green.svg)](.node-version)

Zoen is a governed workspace where people, Eve, apps, and integrations share the same Worlds — with evidence, rights, and erasure as first-class consequences.

Live: [https://zoen.tironi.xyz](https://zoen.tironi.xyz)

## Status

Public TypeScript rebuild on Effect 4. Auth, Worlds, JSON/CSV import, inspection with evidence, correction/undo, and World read grant/revoke already run on real PostgreSQL and S3-compatible storage. More product surface is landing behind the same executor.

## Development

Trunk is `main`. There is no paid Fly staging app — staging is local Docker only (zero Fly staging cost).

Today: `docker compose --env-file .env.infra -f ops/compose.yaml` plus `pnpm provision:local` / `pnpm start:server` (see Quickstart).

Upcoming: `pnpm staging:up` will wrap that loop; details will live in [docs/development.md](docs/development.md) when that doc lands.

PRs against `main`. Protect main requires the Verify job named `required`.

## Quickstart

Node 24, pnpm, Docker, and Python 3:

```bash
git clone https://github.com/EnzoTironi/zoen.git
cd zoen
pnpm install --frozen-lockfile
pnpm build
python3 tooling/prepare_infra.py
docker compose --env-file .env.infra -f ops/compose.yaml up -d --wait
pnpm provision:local
pnpm start:server
```

Open `http://127.0.0.1:4310` and create a normal account. `pnpm cli --help` lists CLI commands. Acceptance against that server:

```bash
ZOEN_TEST_WEB_URL=http://127.0.0.1:4310 \
ZOEN_TEST_CSV_WEB_URL=http://127.0.0.1:4310 \
ZOEN_TEST_SHARING_WEB_URL=http://127.0.0.1:4310 \
pnpm test:acceptance
```

Do not commit Fly secrets or `.env*` files. See [SECURITY.md](SECURITY.md).

## Monorepo

| Path | Role |
| --- | --- |
| `apps/web` | Browser UI over the shared HTTP client |
| `apps/server` | HTTP surface, identity, adapters (PostgreSQL / S3) |
| `apps/cli` | Same verbs as the web, over the same client |
| `packages/contracts` | Effect Schema, HttpApi, public DTOs |
| `packages/authority` | Commit boundary, access, evidence, knowledge, semantic executor |
| `ops/` | Compose, containers, migrations, Fly |
| `tests/` | Integration and acceptance on real components |

## Docs

- [Architecture](docs/architecture.md) — workspaces and composition
- [Invariants](docs/invariants.md) — product laws
- [Roadmap](docs/roadmap.md) — phases and deliveries
- [Quality](docs/quality.md) — gates and proof layers
- [Contributing](CONTRIBUTING.md) — setup and PR rules
- [Security](SECURITY.md) — private vulnerability reporting
- [Releasing](docs/releasing.md) — tags and first GitHub Release

## License

[MIT](LICENSE) © 2026 Enzo Tironi
