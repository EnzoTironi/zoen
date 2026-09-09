# Alchemy (Fly + Docker) — source of truth

`ops/alchemy/alchemy.run.ts` is the **declared** Zoen hosted/local topology. `ops/fly/fly.toml` remains a **transitional mirror** for `flyctl` exact-image CD (ZA-07) until Deploy is cut over to `alchemy deploy`. Prefer editing the alchemy stack first, then mirror env/checks into `fly.toml`.

Docs: [Fly](https://alchemy.run/fly/) · [Docker](https://alchemy.run/docker/) · [Stages](https://alchemy.run/environments/stages/)

## Non-negotiables

| Rule | How this stack enforces it |
| --- | --- |
| No managed Postgres / Tigris | Never yields `Fly.Postgres` / `Fly.Bucket` |
| All-in-one on one volume | `Fly.Machine` mounts `zoen_data` → `/data` (PG + RustFS + app) |
| Do not destroy live prod | `prod` uses `RemovalPolicy.retain(true)` on App/Machine/Secrets/IP |
| Exact-image CD (ZA-07) | Prod image comes from `ZOEN_FLY_IMAGE` only (no competing build/push) |
| Cost | Ephemeral stages: `minMachinesRunning=0` + autostop; `local` = Docker only |

Out of scope here: DNS cutover, destroying legacy `zoen`, Eve / hosted Erased activation, Worlds data plane on managed PG/Tigris.

## Stages

| Stage | Purpose | Cost posture |
| --- | --- | --- |
| `prod` | Adopt/declare `zoen-rebuild` | `minMachinesRunning=1`, retain on destroy |
| `local` / `local_*` | Docker Postgres (+ optional MinIO) | Zero Fly |
| `dev_$USER` (default) | Personal Fly sandbox | Autostop, min 0, destroyable |
| `pr-N` | PR preview | Same; CI stub tears down on close |
| `staging` | Shared pre-prod | Autostop, min 0 |

```bash
pnpm alchemy:plan -- --stage local
pnpm alchemy:deploy -- --stage local
pnpm alchemy:destroy -- --stage local --yes

pnpm alchemy:plan -- --stage prod
# First prod adopt (operator gate — see below):
pnpm alchemy:deploy -- --stage prod --adopt
```

## Fly token setup

1. Create an org deploy token (Fly dashboard or `fly tokens create org`).
2. Export `FLY_API_TOKEN` (CI) **or** run `pnpm exec alchemy login --configure` once and paste the token into the `default` profile.
3. Optional: `alchemy login --profile prod --configure` for a separate prod profile (`--profile prod` on deploy).

Without a token, Fly stages fail closed. Local Docker stages need only a working `docker` CLI context.

## Prod adopt (operator gate)

Live app **`zoen-rebuild`**, volume **`zoen_data`**, and DNS must **not** be destroyed by alchemy. First cutover:

1. Confirm `fly status -a zoen-rebuild` and volume `zoen_data` in `gru`.
2. Export secrets already on the app (do not rotate blindly):
   - `ZOEN_AUTH_SECRET`
   - `ZOEN_S3_ACCESS_KEY` / `ZOEN_S3_SECRET_KEY`
3. Export the **admitted** image digest Fly already runs (or the next Verify GHCR digest after push to Fly registry), as `ZOEN_FLY_IMAGE`.
4. `pnpm alchemy:deploy -- --stage prod --adopt`
5. Diff carefully: alchemy must not replace the App name, region, or volume group. Abort if the plan wants to delete `zoen_data` or recreate the App.
6. Keep `.github/workflows/deploy-fly.yml` as the image promoter until an explicit follow-up switches CD to alchemy with the same admitted digest.

Break-glass rebuild (explicit, not CD): `ZOEN_ALCHEMY_BREAK_GLASS=1 pnpm alchemy:deploy -- --stage prod` may build `ops/containers/all-in-one.Dockerfile` locally — **outside** exact-image admission.

## Exact-image coexistence (ZA-07)

| Path | Image source |
| --- | --- |
| Verify → Deploy Fly (current CD) | GHCR admission → `flyctl deploy --image <digest>` |
| `alchemy deploy --stage prod` | **Requires** `ZOEN_FLY_IMAGE` (same digest class) |
| Ephemeral / break-glass | `Docker.Image` from `all-in-one.Dockerfile` |

Alchemy must not push a different prod tag that CD would then ignore or fight.

## Local Docker

```bash
pnpm alchemy:deploy -- --stage local
# Postgres / MinIO publish on Docker-chosen free host ports (external: 0)
# Inspect: docker port zoen-alchemy-<stage>-postgres 5432
# Disable MinIO with ZOEN_ALCHEMY_LOCAL_S3=0
```

State lives under `.alchemy/` (gitignored). Local Postgres/MinIO data bind-mounts to `.local/alchemy/<stage>/` (also gitignored). Postgres 18 mounts `/var/lib/postgresql` (image volume boundary).

## Cost model

| Mode | Billable surface |
| --- | --- |
| `local` | Laptop Docker only |
| Ephemeral Fly | shared-cpu-1x / 2GB when awake; scales to 0 |
| `prod` | One always-on shared-cpu-1x / 2GB + 10GB volume (same as today) |

Never enable Fly managed Postgres, Redis, or Tigris from this stack.

## CI stub

`.github/workflows/alchemy-preview.yml` is **off** unless `vars.ZOEN_ALCHEMY_PREVIEW=1`. The Fly token is checked at step level (`secrets` cannot appear in job-level `if`). Deploy/destroy share `.alchemy/` via Actions cache so destroy can see deploy state. Ephemeral stages push the all-in-one image to `registry.fly.io` and set `ZOEN_PUBLIC_URL` to `https://zoen-pr-N.fly.dev`.

## HTTP checks

`fly.toml` still declares `/ready` checks (`interval=15s`, `grace=1m`). Declared payload lives in `ops/alchemy/stage.ts` (`FLY_HTTP_READY_CHECK`) for parity tests. Alchemy's MachineService mapper does not yet forward `checks` to the Machines API — keep transitional `fly.toml` checks for CD, and set `ZOEN_ALCHEMY_WAIT_READY=1` (preview CI) to poll `/ready` after Machine create.
