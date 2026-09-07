# Development

## Trunk-based flow

Trunk is `main`. Prefer short-lived PRs against `main`. Protect main already requires the Verify workflow job named `required`.

Merge to `main` is the path to production: continuous deploy targets the Fly app `zoen-rebuild` ([https://zoen.tironi.xyz](https://zoen.tironi.xyz)). That is separate from local work.

There is **no** paid Fly staging environment — no extra Fly apps, machines, MPG, or Tigris for staging.

## Local staging

Staging is a disposable stack developers and agents spin up on demand:

1. Docker Compose (`ops/compose.yaml`) — Postgres + object storage
2. `pnpm provision:local` with an isolated profile
3. `pnpm start:server` against that profile

Cost is laptop Docker only.

### Profile

Scripts use `ZOEN_LOCAL_PROFILE=staging`. That creates `.env.staging` and `.local/staging/` with their own database, roles, and bucket. It does **not** overwrite the default `application` profile.

Compose itself is shared (one Postgres / object-storage project). Profiles isolate installs inside that project.

### Commands

```bash
pnpm install --frozen-lockfile
pnpm build

pnpm staging:up
ZOEN_LOCAL_PROFILE=staging pnpm start:server
```

Open `http://127.0.0.1:4310` and create a normal account.

| Script | Behavior |
| --- | --- |
| `pnpm staging:up` | Create `.env.infra` if missing, `compose up -d --wait`, provision `staging` if `.env.staging` is absent |
| `pnpm staging:down` | `compose down` — keeps volumes and profile files |
| `pnpm staging:reset` | `compose down --volumes` and remove `.env.staging` + `.local/staging` only |
| `pnpm staging:logs` | Follow compose logs |

After `staging:down`, bring the same install back with `pnpm staging:up` (skips provision when `.env.staging` exists) then start the server. After `staging:reset`, `staging:up` provisions a fresh staging install.

### Pre-merge / agent verify

Use local staging before merge when you need a real server against disposable infra. Do not point these scripts at production Fly, and do not create a Fly staging app.

Acceptance against the local server (same pattern as the README):

```bash
ZOEN_LOCAL_PROFILE=staging \
ZOEN_TEST_WEB_URL=http://127.0.0.1:4310 \
ZOEN_TEST_CSV_WEB_URL=http://127.0.0.1:4310 \
ZOEN_TEST_SHARING_WEB_URL=http://127.0.0.1:4310 \
pnpm test:acceptance
```

### What not to commit

`.env*`, `.local/`, Fly secrets, and tokens stay off git (see `.gitignore` and `SECURITY.md` when present).
