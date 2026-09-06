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
| Fly Postgres / Tigris (org) | Nenhum cluster/bucket listado na org. |
| Secrets do rebuild | Não provisionados (autoridade/identity/S3/Better Auth do monólito modular). |
| Perfis Worlds | `d01-local-retained-v1` e candidato `d03-local-erasable-v1` (local); candidato hosted `d04-hosted-retained-v1` (EX36 schemas; sem ativação/deploy). |

## Congelado agora (mínimo executável)

| ID | Decisão | Efeito |
| --- | --- | --- |
| H01 | Perfil **novo** só na criação de Worlds novos: `d04-hosted-retained-v1`. | Sem rebind/migração implícita de Worlds `d01-*` / `d03-*`. |
| H02 | Escopo habilitado = retenção `while-pinned`, `erasure:false`, `restoreAfterErasure:false`, `dataScope: admitted-non-sensitive`, realm `live`. | Piloto hospedado **não** sensível; não promete apagamento nem reopen pós-erasure. |
| H03 | Restore real só do **escopo habilitado** (backup lógico/disposable do perfil retained hospedado). | Sem alegar supressão pós-erasure (ZN-0116) até D03 purge+fencing qualificados. |
| H04 | Sem cutover implícito: app/host novos ≠ substituir `zoen` legado nem DNS `zoen.tironi.xyz` sem decisão explícita. | Stubs usam app candidato `zoen-rebuild` (criar só em EX posterior com custo consciente). |
| H05 | Docker local / imagem CI ≠ operação Fly. | Deploy, persistência gerenciada, backup e recover exigem provas próprias. |
| H06 | Admission flags: canais/modelos/conectores ausentes ficam **explicitamente desabilitados**, nunca mock-saudáveis (ZN-0288). | Web/CLI/file do núcleo D01 no perfil; WhatsApp/Telegram/etc. fora. |
| H07 | `ops/fly/fly.toml` e Dockerfile path são stubs revisáveis; **proibido** `fly deploy` / `fly apps create` / provisionar MPG/Tigris neste freeze. | Auth presente não autoriza gasto; bloqueio documentado até EX de ativação. |
| H08 | Paths de domínio: `hosted/**`, `ops/fly/**`. | Sem rename em massa de rotas/pastas `d0x`. |

## Ainda bloqueado (gates antes de ativar D04 / piloto sensível)

| Gate | Por quê |
| --- | --- |
| Conta de persistência hospedada (PG + object store) | Org sem MPG/Tigris; credenciais rebuild não criadas. |
| App Fly `zoen-rebuild` | Não criado (evita cobrança/recurso ocioso). |
| Deploy + health real | Stubs apenas; máquina legada `zoen` não é prova do rebuild. |
| Catálogo de backup/cópias do host | Necessário para restore admitido além do disposable. |
| D03 purge + restore-after-erasure (ZN-0116) | Pré-requisito do **piloto sensível** D04; Closing/register local ≠ D03 integral. |
| Cutover DNS/legado | Decisão humana explícita; fora deste incremento. |
| Secrets managed + rotação | Inventário abaixo; nenhum valor commitado. |

## Secrets / configuração ausentes (rebuild)

O servidor exige, no mínimo, configuração real (ver `apps/server/src/configuration.ts` e provision local): `ZOEN_PORT`, `ZOEN_LISTEN_HOST`, `ZOEN_AUTHORITY_DATABASE_URL`, `ZOEN_IDENTITY_DATABASE_URL`, opcional `ZOEN_ERASURE_ATTEMPT_DATABASE_URL`, URLs/chaves S3 do adapter, segredo Better Auth / presença. Nenhuma dessas secrets do monólito modular está no app legado `zoen` como contrato do redesign.

## Pacotes EX do primeiro incremento

Ver `planning/execution.json`: **EX35** (freeze) → **EX36** (schemas de política hosted) → **EX37** (restore disposable do escopo retained) / **EX38** (admission flags) em paralelo → **EX39** (stubs ops/fly + verify, sem deploy).

## O que este freeze NÃO é

- Não marca D04 nem D03 como concluídos.
- Não autoriza gastar créditos Fly nem reutilizar o volume/secrets do app `zoen`.
- Não reabre restore-após-erasure.
- Não inventa RPO/RTO, HA enterprise ou células D19.
