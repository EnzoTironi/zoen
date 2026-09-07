# D05 Eve — congelamento mínimo do primeiro incremento (EX40+)

Status: **decisões mínimas congeladas por root em 2026-09-07 (PT)** a partir de `docs/roadmap.md` (D05), `docs/invariants.md` (INV-01), `docs/architecture.md` (journal operacional) e capacidades C001/C002/C006/C007/C008. Isto **não** declara D05 concluído, **não** gasta API/modelo real, **não** admite voz, **não** cria processo `packages/eve` separado e **não** exige redeploy Fly.

Fonte tip de partida: `644d400` (bootstrap hosted-retained local EX35–EX39 em progresso; D04 não ativado em produção).

## Congelado agora (mínimo executável)

| ID | Decisão | Efeito |
| --- | --- | --- |
| F01 | Eve é **cliente semântico** com **estado de relacionamento**; identidade prova presença e autoridade concede direitos de domínio. | INV-01: journal/conversa **não** importam nem recebem credencial da base de autoridade. |
| F02 | Superfície do incremento = **chat textual** com fatos admitidos, incerteza explícita, cancelamento e journal recuperável. | C001/C002/C007 no escopo mínimo; composição grounded cita evidência ou declara unknown/partial. |
| F03 | Journal único de interação é a fonte de retomada; ordem de conversa/turnos é preservada após falha do worker stub. | Recover sem modelo ao vivo no perfil local stub; stream provisório ≠ mensagem visível settled. |
| F04 | Resumos/compaction **não** viram evidência nem autoridade factual. | C006: compaction só contexto; fatos continuam nos refs de evidência/claims. |
| F05 | **Voz fora** deste incremento — perfil/provider de voz permanece bloqueado até qualificação própria (ZN-0063). | Nenhuma rota voice/transcript autoriza ação consequente. |
| F06 | **Modelo/API/conta real** = gate externo de ativação; primeiro proof usa provider **local/stub** descartável. | Sem spend de LLM; real-model fica `Blocked`/`disabled`, nunca mock-saudável. |
| F07 | Perfil candidato **somente proofs locais**: `eve-local-stub-v1`. | Sem rebind de Worlds/`DataPolicy` existentes; sem ativar roteamento de modelo em produção. |
| F08 | Paths de domínio: `eve/**`, `conversation`, `journal`, `evidence`. | Sem pastas/arquivos/funções novas `D0x`/`d0x`; `D05` só como id de entrega/roadmap/título de freeze. |
| F09 | Ferramentas/efeitos cruzam a fronteira semântica idempotente; Eve não é pré-requisito de leituras estruturadas. | Structured calls seguem independentes (SPEC-009 refinement). |

## Ainda bloqueado (gates antes de ativar D05 / modelo real)

| Gate | Por quê |
| --- | --- |
| Qualificação de modelo real + conta/API | `activation_requires` de D05; ZN-0063 / C008. |
| Spend de LLM / provider live | Explicitamente fora deste incremento. |
| Voz / transcript provider | Incremento próprio; F05. |
| Máquina de turnos completa (leases CAS, tool dispatch, streaming prod) | EX posteriores após freeze+schemas+journal stub. |
| Processo separado Eve com credenciais mínimas | Architecture: só quando o produto admitir Eve runtime. |
| Redeploy Fly / cutover legado `zoen` | D04 hosted; fora de Eve. |
| Compaction durable / multi-provider routing | C006/C008 além do stub. |

## Pacotes EX do primeiro incremento

Ver `planning/execution.json`: **EX40** (congelar + schemas) → **EX41** (porta de journal + recoverability stub local sem modelo) → EX posteriores (turn fence, tools, streaming, provider real) quando gates acima existirem.

## O que este freeze NÃO é

- Não marca D05 integral nem C001–C008 concluídos.
- Não autoriza chamar provider de modelo real nem voz.
- Não substitui oráculos ZN-0052–ZN-0063 / SPEC-009–010.
- Não inventa memória universal nem credenciais geradas por modelo.
