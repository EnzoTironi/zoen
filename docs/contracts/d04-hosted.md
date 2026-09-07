# D04 — primeiro produto hospedado (contrato candidato)

Status: candidato. Congelamento mínimo executável em `docs/contracts/d04-hosted-freeze.md`. Entrega estrutural em `planning/deliveries.json` (`D04`, fase P2): deploy Fly, operação e restore reais no escopo habilitado, sem cutover implícito.

## Resultado do incremento EX35+

1. Declarar perfil de World **novo** `d04-hosted-retained-v1` (só Worlds novos).
2. Prometer somente operações comprováveis: hospedagem candidata + restore do escopo retained habilitado.
3. Manter canais/providers não admitidos desabilitados de forma explícita.
4. Separar stubs/ops do ato de deploy (deploy exige EX de ativação posterior e recursos reais).

## Persistência Fly (ativação)

All-in-one VM (`ops/containers/all-in-one.Dockerfile`): Postgres + RustFS + server, volume único `/data`. **Sem** Managed Postgres / Tigris.

## Fora de escopo deste incremento

- Cutover do app legado `zoen` / DNS de produção.
- Piloto sensível com erasure e supressão pós-restore (depende de D03 além de Closing/register).
- HA, multi-região, SSO, self-host equivalence certificate.

## EX36 (schemas)

Perfil `d04-hosted-retained-v1` compilável em `packages/contracts/src/hosted/policy/**` e união `DataPolicySchema` (authority). `erasure:false`, `restoreAfterErasure:false`, `dataScope: admitted-non-sensitive`. Composition/provision locais continuam default `d01-local-retained-v1` até escolha explícita. Sem rebind de Worlds existentes; sem deploy.

## EX37 (restore disposable)

Prova local dump→restore do escopo retained habilitado em ambiente descartável (`tests/integration/hosted/restore/**`). Restore reproduz apenas Worlds/`data_policy_id` `d04-hosted-retained-v1` do install sob prova; Worlds retained locais não são rebound; `restoreAfterErasure` permanece false. Sem alegar ZN-0116, catálogo hosted, nem deploy.

## EX38 (admission flags)

Flags/contratos em `packages/contracts/src/hosted/admission/**` + enforcement em `packages/authority/src/hosted/admission/**`: web/cli/file admitted; WhatsApp/Telegram/OAuth/model/feed/GPU/broker/custodian explicitamente `disabled` (nunca healthy falso). Unidade sob `packages/authority/test/hosted/admission/**`. Sem deploy.

## EX39 (compose/verify local)

Composition + provision local do perfil `d04-hosted-retained-v1` (Worlds novos); admission flags EX38 no layer quando a policy é hosted; evidência em `docs/verification/hosted-local.md` + `tests/integration/hosted/independent/**`. `ops/fly/**` stub. **Sem** deploy/gasto. Não marca D04 ativado.
