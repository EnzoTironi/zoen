# Fly all-in-one (`zoen-rebuild`)

Integrador (`ops/fly/**`). App **`zoen-rebuild`**: **uma VM** com Postgres + RustFS (S3-compatível) + servidor Zoen, dados em **um volume** Fly (`/data`). **Não** usa Managed Postgres (MPG) nem Tigris/S3 gerenciado.

## Topologia

| Peça | Onde |
| --- | --- |
| Imagem | `ops/containers/all-in-one.Dockerfile` |
| Entrypoint | `ops/containers/all-in-one-entrypoint.sh` (sobe PG + RustFS, provisiona, sobe server `:4310`) |
| Volume | `zoen_data` → `/data` (PG + object bytes + `installation.json`) |
| Perfil Worlds novos | `d04-hosted-retained-v1` |
| Hostname cutover | `ops/fly/CUTOVER.md` — **replace** de `zoen.tironi.xyz` → este app (sem dual-write) |

## Secrets

Somente o necessário via `fly secrets` (valores nunca no git/chat):

```bash
fly secrets set ZOEN_AUTH_SECRET="$(openssl rand -hex 32)" -a zoen-rebuild
fly secrets set ZOEN_S3_ACCESS_KEY=zoenlocal ZOEN_S3_SECRET_KEY=zoenlocal-secret-key-min-32b -a zoen-rebuild
```

URLs DB/S3 de loopback ficam no `[env]` do `fly.toml` / volume (`runtime.env`). **Não** recriar MPG/Tigris nem `AWS_*` staged.

## Deploy (raiz do repo)

```bash
fly volumes create zoen_data --region gru --size 10 -a zoen-rebuild --yes   # uma vez
fly deploy -a zoen-rebuild --config ops/fly/fly.toml
fly status -a zoen-rebuild
./ops/fly/scripts/ready-check.sh
```

VM: shared-cpu-1x / 2GB RAM; volume exemplo **10GB**. `min_machines_running = 1`.

## Cutover do hostname legado

Ver **`CUTOVER.md`**. Resumo Pre-launch Evolution:

1. Provar `/ready` em `zoen-rebuild`.
2. `fly certs add zoen.tironi.xyz` neste app.
3. No Cloudflare (registrar), **substituir** A/AAAA (ou CNAME) para os IPs/`zoen-rebuild.fly.dev` deste app.
4. Após cert Issued + `/ready` no hostname custom, **substituir** `ZOEN_PUBLIC_URL` por `https://zoen.tironi.xyz` e redeploy.
5. Só então `scale count 0` no app legado `zoen` — **nunca** destroy sem decisão explícita.
6. Dados do volume legado **não** migram; rebuild é install greenfield/disposable.

Scripts: `ops/fly/scripts/{inventory,ready-check,certs-add-hostname,scale-stop-legacy}.sh`.

## Continuous deploy (GitHub Actions)

Push to `main` runs **Verify** and **Deploy Fly** in parallel; Deploy waits for Verify on the **same commit SHA**, then:

```bash
flyctl deploy -a zoen-rebuild --config ops/fly/fly.toml
curl -fsS https://zoen-rebuild.fly.dev/ready   # fail closed
```

Verify gate (exact SHA):

- **success** → deploy proceeds
- **cancelled** / **skipped** (rapid `main` pushes cancel Verify via `cancel-in-progress`) → Deploy exits **success without deploying**; the newer tip's Deploy run is the one that matters
- **failure** (or other non-success) → Deploy **fails closed**

Workflow: `.github/workflows/deploy-fly.yml` (`push` to `main` + `workflow_dispatch`). Concurrency group `deploy-fly-zoen-rebuild` with `cancel-in-progress: false` so a mid-deploy is never cancelled by a newer push (newer pushes queue until the current deploy finishes).

### One-time: `FLY_API_TOKEN` repo secret

Create a deploy token scoped to this app, then store it as a GitHub Actions secret (names only in CI logs):

```bash
fly tokens create deploy -x 999999h -a zoen-rebuild
gh secret set FLY_API_TOKEN --repo EnzoTironi/zoen
```

Paste the token value into `gh secret set` when prompted (or pipe it). Without `FLY_API_TOKEN`, the Deploy job fails closed at `flyctl deploy`.

Manual run: Actions → **Deploy Fly** → **Run workflow** (skips the Verify wait; still health-checks after deploy).

## Object Lock re-probe (D03 storage)

Live Fly RustFS Object Lock qualification (loopback): [`docs/verification/erasure-fly-object-lock.md`](../../docs/verification/erasure-fly-object-lock.md). Evidence under `ops/fly/evidence/object-lock-reprobe-*`. Does **not** claim hosted Erased.

## Regras

1. **Não** provisionar MPG / Tigris / storage gerenciado para este app.
2. Cutover = **replace** de DNS/hostname; sem dual-serve, dual-read ou dual-write com o legado.
3. Nunca colar valores de secret em logs/commits.
4. Nunca `fly apps destroy zoen` a partir destes scripts.
