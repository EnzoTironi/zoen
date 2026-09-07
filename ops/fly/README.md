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

## Regras

1. **Não** provisionar MPG / Tigris / storage gerenciado para este app.
2. Cutover = **replace** de DNS/hostname; sem dual-serve, dual-read ou dual-write com o legado.
3. Nunca colar valores de secret em logs/commits.
4. Nunca `fly apps destroy zoen` a partir destes scripts.
