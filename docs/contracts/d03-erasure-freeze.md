# D03 erasure — congelamento mínimo executável (EX30+)

Status: **decisões mínimas congeladas por root em 2026-09-06 (PT)** a partir de `docs/contracts/d03-erasure.md` (revisão ER-R01–05 em `d03-erasure.review.md`). Isto **não** admite perfil em Worlds existentes, **não** autoriza purge real, **não** qualifica controlador/storage/backups e **não** libera restore após erasure.

Fonte tip: `cae72de`. Sharing D03.1 (EX20–EX23) permanece o predecessor verificado; o incremento subject-identity-v2 (EX24–EX29) está `verified_for_profile` no mesmo tip sem concluir D02 integral.

## Congelado agora (mínimo executável)

| ID | Decisão | Efeito |
| --- | --- | --- |
| F01 / ER-R01 | Registrar a **existência da tentativa** em unidade fora do rollback da aplicação **antes** do commit local irreversível de Closing. | Sem registro externo confirmado (Registrada), nenhuma decisão local de erasure. Registro pendente **não** é supressão, consentimento, grant nem autorização de purge. |
| F02 | Perfil **novo** somente na criação de Worlds novos; `d01-local-retained-v1` intacto (`erasure:false`, `restoreAfterErasure:false`). | Sem rebind/migração implícita de Worlds antigos. Identificador congelado do perfil candidato: `d03-local-erasable-v1`. |
| F03 | Escopo = **World inteiro** (Frames, Questions, correções, grants de conteúdo, imports, objetos admitidos/staged e versões órfãs do namespace). | Não apaga conta, outros Worlds, nem bytes já liberados ao transporte / cópias de terceiros. |
| F04 | `restoreAfterErasure` permanece **false** / restore após erasure **bloqueado** até controlador, âncora anti-rollback, catálogo de cópias e fencing estarem qualificados. | Nenhum ticket pode oferecer reopen de conteúdo apagado. |
| F05 | Commit local de Closing (receipt imutável + outbox) é o ponto irreversível da **decisão autorizada**; HTTP de sucesso só após observar Confirmada no registro. | Replay não promove Closing→Erased; progresso fica em inspeção administrativa. |
| F06 | Desfecho perdido com a origem: disponibilidade sacrificada — tentativa permanece **Unknown/Unavailable** (pode ser indefinida) e restore/ativação permanece fechado. **Não** inferir Abortada da ausência em backup antigo. | Default de produto do candidato, documentado aqui. |
| F07 | Abortada só com prova de desfecho local definitivo **sem** decisão de erasure (registro operacional exclusivo com Closing); nunca por timeout/TTL. | Sem essa prova, conservar Registrada/Unknown. |
| F08 | Receipt mínimo imutável vs progresso mutável (ER-R04); porta de purge **não** reutiliza `EvidenceObjectStore.remove` / normalização de versionId (ER-R05). | Interfaces novas sob domínio `erasure/**`. |
| F09 | Sem bypass de Object Lock, legal hold, retenção obrigatória ou pins inter-World sem regra explícita. | Hold/impedimento → Blocked, sem elevação de grants. |

## Ainda bloqueado (gates antes de purge real)

| Gate | Por quê |
| --- | --- |
| Serviço controlador real | Topologia, grants distintos, epochs/admissões, durabilidade fora do rollback da app e âncora monotônica independente **não** qualificados. |
| Catálogo completo de backups/cópias | Dump lógico, basebackup/WAL, volumes, réplicas S3, identidade, índices, temporários — ausente como admissão. |
| Object Lock / retention / multipart / replicação no storage real | SDK ≠ admissão RustFS; porta de purge e inventário ListObjectVersions ainda não provados para erasure. |
| ER-R02 — barreira World + contenção de uploads | Ordem de locks e prova de PUT/multipart em voo ainda por congelar/qualificar; fence de sessão/membership atual não cobre World inteiro. |
| ER-R03 — restore online / ativação por head | Protocolo candidato apenas; restore após erasure permanece fechado (F04). |
| Destruição física / prazo regulatório | DELETE/VACUUM/version delete não demonstram mídia; perfil bloqueado se a política exigir o que o provedor não prova. |
| Qualificação de pins locais superados por erasure | Matriz explícita ainda necessária antes de admitir o perfil em produção. |
| Implementação completa de purge SQL/S3 | EX packages abaixo cobrem contrato→registro→Closing→UI→verify; purge/Erased exige gates acima. |

## Pacotes EX do primeiro incremento

Ver `planning/execution.json`: **EX30** (congelar + schemas) → **EX31** (porta de registro de tentativa) → **EX32** (Closing local) → **EX33** (Web/CLI confirmação) → **EX34** (compor/verificar). Paths de domínio: `erasure/**` (não `d03-*` em pastas novas). Rotas HTTP legadas `/api/d0x/` existentes não são renomeadas em massa.

## O que este freeze NÃO é

- Não marca D03 integral nem D02 merge/split stewardship completos.
- Não autoriza apagar dados de Worlds `d01-local-retained-v1`.
- Não substitui oráculos ER01–ER31 nem revisão independente.
- Não inventa RPO/RTO, KMS por World ou APIs de fornecedor.
