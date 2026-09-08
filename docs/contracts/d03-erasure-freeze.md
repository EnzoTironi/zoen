# D03 erasure — congelamento mínimo executável (EX30+)

Status: **decisões mínimas congeladas por root em 2026-09-06 (PT)** a partir de `docs/contracts/d03-erasure.md` (revisão ER-R01–05 em `d03-erasure.review.md`). Incremento **2026-09-07 (PT)**: RustFS local qualificado para versioning + Object Lock/retention/legal hold; portas `ErasureObjectInventory` / `ErasurePurgeStore` (EX44) com holds fail-closed. Incremento EX45 (2026-09-07 PT): Closing→Erased local para **cópias controladas** (SQL + prefixo de objeto) via `PurgeWorldContent`, attestationScope=`local-controlled-copies`. Incremento ZA-12 (2026-09-08 PT): catálogo de cópias controladas (SQL dump/object/volume/temp/log) com disposições e cobertura por perfil; Unknown (incl. G-OPS hospedado sem verificação read-only) **bloqueia** Full Erased/restore. Isto **não** admite perfil em Worlds existentes, **não** qualifica controlador independente no Fly all-in-one, **não** prova contenção de uploads externos (ZA-10), e **não** libera `restoreAfterErasure`.

Fonte tip: `cae72de`. Sharing D03.1 (EX20–EX23) permanece o predecessor verificado; o incremento subject-identity-v2 (EX24–EX29) está `verified_for_profile` no mesmo tip sem concluir D02 integral.

## Congelado agora (mínimo executável)

| ID | Decisão | Efeito |
| --- | --- | --- |
| F01 / ER-R01 | Registrar a **existência da tentativa** em unidade fora do rollback da aplicação **antes** do commit local irreversível de Closing. | Sem registro externo confirmado (Registrada), nenhuma decisão local de erasure. Registro pendente **não** é supressão, consentimento, grant nem autorização de purge. |
| F02 | Perfil **novo** somente na criação de Worlds novos; `worlds-local-retained-v1` intacto (`erasure:false`, `restoreAfterErasure:false`). | Sem rebind/migração implícita de Worlds antigos. Identificador congelado do perfil candidato: `worlds-local-erasable-v1`. |
| F03 | Escopo = **World inteiro** (Frames, Questions, correções, grants de conteúdo, imports, objetos admitidos/staged e versões órfãs do namespace). | Não apaga conta, outros Worlds, nem bytes já liberados ao transporte / cópias de terceiros. |
| F04 | `restoreAfterErasure` permanece **false** / restore após erasure **bloqueado** até controlador, âncora anti-rollback, catálogo de cópias e fencing estarem qualificados. | Nenhum ticket pode oferecer reopen de conteúdo apagado. |
| F05 | Commit local de Closing (receipt imutável + outbox) é o ponto irreversível da **decisão autorizada**; HTTP de sucesso só após observar Confirmada no registro. | Replay não promove Closing→Erased; progresso fica em inspeção administrativa. |
| F06 | Desfecho perdido com a origem: disponibilidade sacrificada — tentativa permanece **Unknown/Unavailable** (pode ser indefinida) e restore/ativação permanece fechado. **Não** inferir Abortada da ausência em backup antigo. | Default de produto do candidato, documentado aqui. |
| F07 | Abortada só com prova de desfecho local definitivo **sem** decisão de erasure (registro operacional exclusivo com Closing); nunca por timeout/TTL. | Sem essa prova, conservar Registrada/Unknown. |
| F08 | Receipt mínimo imutável vs progresso mutável (ER-R04); porta de purge **não** reutiliza `EvidenceObjectStore.remove` / normalização de versionId (ER-R05). | Interfaces novas sob domínio `erasure/**`. |
| F09 | Sem bypass de Object Lock, legal hold, retenção obrigatória ou pins inter-World sem regra explícita. | Hold/impedimento → Blocked, sem elevação de grants. |

## Gates atualizados (2026-09-07 PT)

| Gate | Estado |
| --- | --- |
| RustFS local: versioning + ListObjectVersions + multipart abort | **Cleared (local compose)** — ver `docs/verification/erasure-storage-qualification.md` + feasibility anterior |
| RustFS local: Object Lock / retention / legal hold enforce | **Cleared (local compose)** — CreateBucket ObjectLock + Put/Get retention/hold; delete sem bypass → 403 |
| Porta inventário + purge S3 (não reusa `EvidenceObjectStore.remove`) | **Cleared (código+integração EX44)** — holds → `Blocked`; sem Bypass no caminho de produto |
| Bucket Object Lock em installs **novos** `worlds-local-erasable-v1` | **Cleared (provision)** — `ObjectLockEnabledForBucket` só quando `policy.erasure`; retained intacto |
| Serviço controlador real / âncora anti-rollback (Fly all-in-one) | **Blocked** — volume único PG+RustFS; register local EX31 ≠ controlador qualificado |
| Catálogo de backups/cópias (perfil local selecionado) | **Cleared ZA-12** — bounded cut + disposições; não eterno |
| Catálogo hospedado / G-OPS | **Unknown → fail-closed** — sem verificação read-only de operador; bloqueia Full Erased/restore |
| ER-R02 — barreira World (SQL/disclosure local) | **Cleared ZA-09** — `jobs.disclosure_world_closing` + admitted epoch on content paths; membership enumeration is not a substitute |
| ER-R02 — contenção de uploads externos (late PUT) | **Admission/settlement implemented (ZA-10); G-STORAGE-FENCE Blocked** — Object Lock/probe ≠ writer fence; Unknown/cancel fail-closed |
| ER-R03 — restore online / ativação por head | **Blocked** (F04; `restoreAfterErasure:false`) |
| Destruição física / prazo regulatório | **Blocked** |
| Qualificação de pins locais superados por erasure | **Blocked** |
| Purge SQL + transição Closing→Erased (local controlled copies) | **Cleared EX45** — full D03 Erased still blocked (controller/G-OPS Unknown/ZA-10/Fly) |
| Re-prova Object Lock na VM Fly live | **Blocked** até probe no app `zoen-rebuild` |

## Pacotes EX do primeiro incremento

Ver `planning/execution.json`: **EX30** (congelar + schemas) → **EX31** (porta de registro de tentativa) → **EX32** (Closing local) → **EX33** (Web/CLI confirmação) → **EX34** (compor/verificar) → **EX44** (qualificação RustFS Object Lock + inventário/purge S3 fail-closed) → **EX45** (Closing→Erased local controlled copies). Paths de domínio: `erasure/**` (não `d03-*` em pastas novas). Rotas HTTP legadas `/api/d0x/` existentes não são renomeadas em massa.

## O que este freeze NÃO é

- Não marca D03 integral nem D02 merge/split stewardship completos.
- Não autoriza apagar dados de Worlds `worlds-local-retained-v1`.
- Não substitui oráculos ER01–ER31 nem revisão independente.
- Não inventa RPO/RTO, KMS por World ou APIs de fornecedor.
