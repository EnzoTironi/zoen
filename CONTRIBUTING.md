# Contributing

PRs against `main`. Direct pushes to `main` are blocked.

## Setup

You need Docker, Node 24 (see `.node-version`), and pnpm (`packageManager` in `package.json`).

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

Open `http://127.0.0.1:4310`. Details live in the [README](README.md).

## Gates

Run the same checks CI runs before you open a PR:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
```

The Verify workflow job named `required` must pass. Do not add mocks of services, fabricated provider responses, privileged development identity, or offline fallbacks — see [AGENTS.md](AGENTS.md) and [docs/quality.md](docs/quality.md).

Do not commit Fly secrets, tokens, or `.env*` files (except `.env.example` if present).

## Pull requests

1. Open an issue first if the change is not a small fix.
2. Keep the diff to one concern.
3. The `required` CI job must pass.
4. Resolve review comments before merge.

Use an issue template. Questions belong in [Discussions](https://github.com/EnzoTironi/zoen/discussions).

## Code of Conduct

Participation is covered by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Security

Do not file public issues for vulnerabilities. See [SECURITY.md](SECURITY.md).
