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

Surfaces first: **web**, **CLI**, and **MCP** (same World verbs). Later SDK/agent adapters sit over that grammar — not a separate chat product. Product surface is ontology **Worlds** only.

## Live

[https://zoen.tironi.xyz](https://zoen.tironi.xyz)

**Status:** tip on Fly `zoen-rebuild` tracks `main`; post-#74 frontier is documented in [docs/architecture-audit/](docs/architecture-audit/README.md). Selected-frontier close (ZA-26) on tip `aa7bc31` is recorded in [docs/verification/frontier-integration.md](docs/verification/frontier-integration.md) — not full-horizon acceptance. Honest increments: `planning/progress.json`.

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
| `apps/mcp` | Stdio MCP server — Worlds + subject-identity verbs as tools over the same client |
| `packages/contracts` | Effect Schema, HttpApi, public DTOs |
| `packages/application-client` | Shared session + ApplicationApi HTTP client for CLI/MCP |
| `packages/ontology` | Commit boundary, access, evidence, knowledge, semantic executor |
| `ops/` | Compose, containers, migrations, Fly |
| `tests/` | Integration and acceptance on real components |

## MCP (Cursor / Claude)

`@zoen/mcp` v0 exposes the same Worlds **and subject-identity** semantic verbs as the CLI as MCP tools over stdio. CLI and MCP share `@zoen/application-client` (session.json + ApplicationApi HTTP routing). Tools assemble a `SemanticRequest`, decode it with the same contracts as CLI/web, then call `/api/*/execute`. Writes still go through the server semantic executor (policy + receipts). Sign-in stays on the CLI (no password tools on MCP). There is no Eve/chat/voice surface.

1. Build: `pnpm install --frozen-lockfile && pnpm build`
2. Sign in with the CLI (session file is reused):

```bash
pnpm cli -- --base-url http://127.0.0.1:4310 sign-in --email you@example.com --password-file /private/password
```

3. Point Cursor or Claude Desktop at the stdio server (example Cursor `mcp.json`):

```json
{
  "mcpServers": {
    "zoen": {
      "command": "node",
      "args": ["/absolute/path/to/zoen/apps/mcp/dist/main.js"],
      "env": {
        "ZOEN_BASE_URL": "http://127.0.0.1:4310"
      }
    }
  }
}
```

Optional: `ZOEN_SESSION_DIR` overrides the default `~/.config/zoen` session directory (must match the CLI session you created). Tools use contract operation names for Worlds and subject-identity (`CreatePersonalWorld`, `ImportEvidence`, `Inspect`, `InspectSubjectIdentity`, `ProposeIdentityResolution`, `ResolveIdentity`, `GrantWorldReadAccess`, `RequestWorldErasure`, …).

## Docs

- [Architecture](docs/architecture.md) — workspaces and composition
- [Architecture audit (post-#74 frontier)](docs/architecture-audit/README.md) — execution frontier, anti-list, ZA plan (docs only; 0 ZA accepted)
- [Frontier integration (ZA-26)](docs/verification/frontier-integration.md) — tip-bound selected-frontier status (finance demo; conditional gates stay blocked)
- [Invariants](docs/invariants.md) — product laws
- [Roadmap](docs/roadmap.md) — phases and deliveries
- [Quality](docs/quality.md) — gates and proof layers
- [Contributing](CONTRIBUTING.md) — setup and PR rules
- [Security](SECURITY.md) — private vulnerability reporting
- [Releasing](docs/releasing.md) — tags and first GitHub Release

## License

[MIT](LICENSE) © 2026 Enzo Tironi
