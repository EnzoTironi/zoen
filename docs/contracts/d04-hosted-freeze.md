# D04 hosted — congelamento mínimo do primeiro incremento (EX35+)

Status: **decisões mínimas congeladas por root em 2026-09-06 (PT)** a partir de `docs/roadmap.md` (D04), `docs/architecture.md` e inventário operacional abaixo. Isto **não** declara D04 ativado, **não** faz deploy, **não** gasta créditos Fly, **não** cutover do app legado `zoen`, **não** marca D03 integral e **não** habilita restore-após-erasure.

Fonte tip de partida: `bb608c4` (Closing/register local EX30–EX34 verificado em progresso; purge/restore-after-erasure ainda bloqueados).

## Inventário (2026-09-06 PT)

| Item | Estado |
| --- | --- |
| `ops/containers/application.Dockerfile` | Existe (Node 24 multi-stage, `EXPOSE 4310`, `CMD` server dist). |
| `ops/compose.yaml` | PG + RustFS locais apenas; sem serviço de app. |
| `ops/fly/**` | Ausente até este incremento — stubs sem deploy. |
| CLI `fly` / auth | Presente (`enzo.tironi.2001@gmail.com`, org personal). |
| App Fly legado `zoen` | Existe em `gru`; imagem/legado distinto; health check critical; secrets de produto antigo (Restate/WhatsApp/MinIO loopback). **Não é destino de cutover.** |
| Persistência hosted | All-in-one VM+volume (PG+RustFS); MPG/Tigris **rejeitados** (não recriar). |
| Secrets do rebuild | Não provisionados (autoridade/identity/S3/Better Auth do monólito modular). |
| Perfis Worlds | `worlds-local-retained-v1` e candidato `d03-local-erasable-v1` (local); candidato hosted `d04-hosted-retained-v1` (EX36 schemas; sem ativação/deploy). |

### Atualização operacional (2026-09-07 PT)

App Fly **`zoen-rebuild` está live** all-in-one (PG+RustFS+app no volume, `min_machines_running=1`, https://zoen-rebuild.fly.dev). Secrets incluem `ZOEN_OPENCODE_*`. **MPG/Tigris destruídos por desenho — não reviver.** Isto **não** marca D04 `activated`, **não** cutover do legado `zoen`, e **não** habilita piloto sensível / restore-após-erasure.

## Congelado agora (mínimo executável)

| ID | Decisão | Efeito |
| --- | --- | --- |
| H01 | Perfil **novo** só na criação de Worlds novos: `d04-hosted-retained-v1`. | Sem rebind/migração implícita de Worlds `d01-*` / `d03-*`. |
| H02 | Escopo habilitado = retenção `while-pinned`, `erasure:false`, `restoreAfterErasure:false`, `dataScope: admitted-non-sensitive`, realm `live`. | Piloto hospedado **não** sensível; não promete apagamento nem reopen pós-erasure. |
| H03 | Restore real só do **escopo habilitado** (backup lógico/disposable do perfil retained hospedado). | Sem alegar supressão pós-erasure (ZN-0116) até D03 purge+fencing qualificados. |
| H04 | Sem cutover implícito: app/host novos ≠ substituir `zoen` legado nem DNS `zoen.tironi.xyz` sem decisão explícita. | Stubs usam app candidato `zoen-rebuild` (criar só em EX posterior com custo consciente). |
| H05 | Docker local / imagem CI ≠ operação Fly. | Deploy, persistência gerenciada, backup e recover exigem provas próprias. |
| H06 | Admission flags: canais/modelos/conectores ausentes ficam **explicitamente desabilitados**, nunca mock-saudáveis (ZN-0288). | Web/CLI/file do núcleo D01 no perfil; WhatsApp/Telegram/etc. fora. |
| H07 | Hosted = all-in-one Dockerfile+volume; **proibido** provisionar MPG/Tigris. Deploy do `zoen-rebuild` exige confirmação de custo (feita — app live). | MPG/Tigris não reviver; cutover `zoen` continua bloqueado. |
| H08 | Paths de domínio: `hosted/**`, `ops/fly/**`. | Sem rename em massa de rotas/pastas `d0x`. |

## Ainda bloqueado (gates antes de ativar D04 / piloto sensível)

| Gate | Por quê |
| --- | --- |
| Conta de persistência hospedada | **Resolvido** — volume all-in-one na VM (MPG/Tigris rejeitados; não reviver). |
| App Fly `zoen-rebuild` | **Live** all-in-one (`min_machines_running=1`, https://zoen-rebuild.fly.dev); secrets incluem `ZOEN_OPENCODE_*`. |
| Deploy + health real | **Live** — VM all-in-one; legado `zoen` não conta como evidência. |
| Catálogo de backup/cópias do host | Ainda necessário para restore admitido além do disposable. |
| D03 purge + restore-after-erasure (ZN-0116) | Pré-requisito do **piloto sensível** D04; Closing/register local ≠ D03 integral. |
| Cutover DNS/legado | Decisão humana explícita; fora deste incremento. |
| Secrets managed + rotação | Mínimo live no app; rotação/inventário completo e valores nunca commitados. |

## Secrets / configuração ausentes (rebuild)

O servidor exige, no mínimo, configuração real (ver `apps/server/src/configuration.ts` e provision local): `ZOEN_PORT`, `ZOEN_LISTEN_HOST`, `ZOEN_AUTHORITY_DATABASE_URL`, `ZOEN_IDENTITY_DATABASE_URL`, opcional `ZOEN_ERASURE_ATTEMPT_DATABASE_URL`, URLs/chaves S3 do adapter, segredo Better Auth / presença. Nenhuma dessas secrets do monólito modular está no app legado `zoen` como contrato do redesign.

## Pacotes EX do primeiro incremento

Ver `planning/execution.json`: **EX35** (freeze) → **EX36** (schemas de política hosted) → **EX37** (restore disposable do escopo retained) / **EX38** (admission flags) em paralelo → **EX39** (stubs ops/fly + verify, sem deploy).

## O que este freeze NÃO é

- Não marca D04 nem D03 como concluídos.
- Não autoriza gastar créditos Fly nem reutilizar o volume/secrets do app `zoen`.
- Não reabre restore-após-erasure.
- Não inventa RPO/RTO, HA enterprise ou células D19.

## Identities (ZA-05)

Hosted all-in-one keeps **one VM/volume profile** while separating bootstrap, database, object-store and application identities:

| Boundary | Enforcement |
| --- | --- |
| Postgres loopback | SCRAM-SHA-256 only (no `trust`). Infra role `zoen_infra` password lives under `/data/bootstrap/` (root-only sibling of `/data/zoen`; app cannot rename it). |
| Process user | Application runs as OS user `zoen` (UID 10001). Bootstrap secrets are not in the app environment. |
| Object store | RustFS root credentials stay in bootstrap files / bootstrap env only. Application receives a scoped IAM user limited to the admitted bucket via RustFS `/rustfs/admin/v3` APIs. |
| Fail-closed | Missing/rotated bootstrap admin password prevents readiness; app config rejects inherited `ZOEN_BOOTSTRAP_ADMIN_URL` / `ZOEN_S3_ADMIN_*`; completed installs refuse bucket retarget that would cut off stored objects; `runtime.env` is loaded without shell `source`. |

**Not claimed by this PR:** live Fly redeploy/qualification (`G-OPS`), paid staging, or independent erasure-controller isolation (`H-01`). Local all-in-one identity probes are required before treating the profile as identity-qualified.
