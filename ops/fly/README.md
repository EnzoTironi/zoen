# Fly all-in-one (`zoen-rebuild`)

Integrador (`ops/fly/**`). App candidato **`zoen-rebuild`**: **uma VM** com Postgres + RustFS (S3-compatível) + servidor Zoen, dados em **um volume** Fly (`/data`). **Não** usa Managed Postgres (MPG) nem Tigris/S3 gerenciado.

## Topologia

| Peça | Onde |
| --- | --- |
| Imagem | `ops/containers/all-in-one.Dockerfile` |
| Entrypoint | `ops/containers/all-in-one-entrypoint.sh` (sobe PG + RustFS, provisiona, sobe server `:4310`) |
| Volume | `zoen_data` → `/data` (PG + object bytes + `installation.json`) |
| Perfil Worlds novos | `d04-hosted-retained-v1` |
| Legado `zoen` | Fora de escopo — sem cutover |

## Secrets

Somente o necessário via `fly secrets` (valores nunca no git/chat):

```bash
# gera e define sem ecoar o valor
fly secrets set ZOEN_AUTH_SECRET="$(openssl rand -hex 32)" -a zoen-rebuild
# loopback-only object store keys (not public S3); optional if entrypoint defaults suffice
fly secrets set ZOEN_S3_ACCESS_KEY=zoenlocal ZOEN_S3_SECRET_KEY=zoenlocal-secret-key-min-32b -a zoen-rebuild
```

URLs DB/S3 de loopback ficam no `[env]` do `fly.toml` / volume (`runtime.env`). **Não** recriar MPG/Tigris nem `AWS_*` staged.

## Deploy (raiz do repo)

```bash
fly volumes create zoen_data --region gru --size 10 -a zoen-rebuild --yes   # uma vez
fly deploy -a zoen-rebuild --config ops/fly/fly.toml
fly status -a zoen-rebuild
# scale: fly scale count 1 -a zoen-rebuild
curl -fsS "https://zoen-rebuild.fly.dev/ready"
```

VM: shared-cpu-1x / 2GB RAM; volume exemplo **10GB**. Custo baixo; `min_machines_running = 1` (VM quente; evita cold start lento do all-in-one).

## Regras

1. **Não** provisionar MPG / Tigris / storage gerenciado para este app.
2. **Não** cutover do app legado `zoen` nem DNS de produção sem decisão explícita.
3. Nunca colar valores de secret em logs/commits.
