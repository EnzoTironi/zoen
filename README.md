# Zoen

[![Verify](https://github.com/EnzoTironi/zoen/actions/workflows/verify.yml/badge.svg)](https://github.com/EnzoTironi/zoen/actions/workflows/verify.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) [![Node.js](https://img.shields.io/badge/Node.js-24-green.svg)](.node-version)

Shared governed Worlds for private truth — with evidence, rights, and erasure as first-class consequences.

## Who it’s for

Same grammar across ICPs already named in the roadmap (no new commercial personas):

- **Doméstico / household** — Import divergent household lists (bills, chores, commitments); see which source said what; correct one item and undo without losing history. Supported journey: [docs/product/household-commitments.md](docs/product/household-commitments.md) (ZA-22).
- **Confeitaria / bakery shop** — Reconcile orders, recipes, and stock notes from CSV/JSON dumps; keep shop meaning inspectable before anyone acts on it. Supported journey: [docs/product/bakery-order-reconciliation.md](docs/product/bakery-order-reconciliation.md) (ZA-23).
- **Clínica / clinic** — Keep administrative schedule truth under current rights; inspect evidence when two sources disagree; clinical scope stays a separate, qualified profile. Supported journey: [docs/product/clinic-administrative-scope.md](docs/product/clinic-administrative-scope.md) (ZA-24).
- **Finanças / personal or small-business finance** — Admit statements and ledgers as sources; distinguish known vs unknown; never treat a local interpretation as bank settlement. Supported journey: [docs/product/finance-record-reconciliation.md](docs/product/finance-record-reconciliation.md) (ZA-25).

## What you do

1. Authenticate
2. Create a World
3. Import divergent sources (JSON/CSV) about the same commitment
4. Inspect meaning with evidence
5. Correct / mark unknown / undo — history stays
6. Share and revoke (when enabled)
7. Retention / erasure when qualified

Surfaces first: **web** and **CLI** (same verbs). Agent, SDK, and MCP come later as adapters over that grammar. Eve is an optional conversation/voice layer (D05) over the same semantic executor — not part of the application grammar.

## Live

[https://zoen.tironi.xyz](https://zoen.tironi.xyz)

**Status:** tip on Fly `zoen-rebuild` is deployed; post-#74 execution frontier is documented in [docs/architecture-audit/](docs/architecture-audit/README.md) (ZA not accepted). Honest verified increments live in `planning/progress.json`.

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
| `packages/ontology` | Commit boundary, access, evidence, knowledge, semantic executor |
| `ops/` | Compose, containers, migrations, Fly |
| `tests/` | Integration and acceptance on real components |

## Docs

- [Architecture](docs/architecture.md) — workspaces and composition
- [Architecture audit (post-#74 frontier)](docs/architecture-audit/README.md) — execution frontier, anti-list, ZA plan (docs only; 0 ZA accepted)
- [Invariants](docs/invariants.md) — product laws
- [Roadmap](docs/roadmap.md) — phases and deliveries
- [Quality](docs/quality.md) — gates and proof layers
- [Contributing](CONTRIBUTING.md) — setup and PR rules
- [Security](SECURITY.md) — private vulnerability reporting
- [Releasing](docs/releasing.md) — tags and first GitHub Release

## License

[MIT](LICENSE) © 2026 Enzo Tironi
