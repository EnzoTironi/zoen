# D05 Eve — congelamento mínimo do primeiro incremento (EX40+)

Status: **decisões mínimas congeladas por root em 2026-09-07 (PT)** a partir de `docs/roadmap.md` (D05), `docs/invariants.md` (INV-01), `docs/architecture.md` (journal operacional) e capacidades C001/C002/C006/C007/C008. Atualizado no mesmo dia para admitir **OpenCode Zen free** como caminho de produto quando a key estiver presente (ZN-0063). Isto **não** declara D05 concluído, **não** admite voz, **não** cria processo `packages/eve` separado e **não** corta o app legado `zoen`.

Fonte tip de partida (stub): `644d400`. Tip Zen live: ver `docs/verification/eve-opencode-zen.md`.

## Congelado agora (mínimo executável)

| ID | Decisão | Efeito |
| --- | --- | --- |
| F01 | Eve é **cliente semântico** com **estado de relacionamento**; identidade prova presença e autoridade concede direitos de domínio. | INV-01: journal/conversa **não** importam nem recebem credencial da base de autoridade **nem** a API key OpenCode. |
| F02 | Superfície do incremento = **chat textual** com fatos admitidos, incerteza explícita, cancelamento e journal recuperável. | C001/C002/C007 no escopo mínimo; composição grounded cita evidência ou declara unknown/partial. |
| F03 | Journal único de interação é a fonte de retomada; ordem de conversa/turnos é preservada após falha do worker. | Recover sem re-chamar o modelo; stream provisório ≠ mensagem visível settled. |
| F04 | Resumos/compaction **não** viram evidência nem autoridade factual. | C006: compaction só contexto; fatos continuam nos refs de evidência/claims. |
| F05 | **Voz fora** deste incremento — perfil/provider de voz permanece bloqueado até qualificação própria (ZN-0063). | Nenhuma rota voice/transcript autoriza ação consequente. |
| F06 | **OpenCode Zen free** é o caminho de produto admitido quando `ZOEN_OPENCODE_API_KEY` (ou Fly secret) está presente; falhas upstream são `Blocked`/`Unavailable` honestas — nunca mock-saudáveis. | Qualificação registrada em `docs/verification/eve-opencode-zen.md` (headers free-tier, model `big-pickle`). |
| F07 | Perfis: produto `eve-opencode-zen-v1` / admission `opencode-zen`; `eve-local-stub-v1` / `stub-local` **somente** proofs offline de unidade. | Sem rebind de Worlds/`DataPolicy` existentes; stub não é o path de produto. |
| F08 | Paths de domínio: `eve/**`, `conversation`, `journal`, `evidence`. | Sem pastas/arquivos/funções novas `D0x`/`d0x`; `D05` só como id de entrega/roadmap/título de freeze. |
| F09 | Ferramentas/efeitos cruzam a fronteira semântica idempotente; Eve não é pré-requisito de leituras estruturadas. | Structured calls seguem independentes (SPEC-009 refinement). |

## Ainda bloqueado (gates antes de D05 integral)

| Gate | Por quê |
| --- | --- |
| Voz / transcript provider | Incremento próprio; F05. |
| Máquina de turnos completa (leases CAS, tool dispatch, streaming prod) | EX posteriores após provider live. |
| Processo separado Eve com credenciais mínimas | Architecture: só quando o produto admitir Eve runtime. |
| Cutover legado `zoen` / DNS | D04 hosted; fora de Eve. |
| Compaction durable / multi-provider routing | C006/C008 além de Zen free. |

## Pacotes EX

Ver `planning/execution.json`: **EX40** (freeze + schemas) → **EX41** (journal recoverability) → **EX42** (OpenCode Zen client) → **EX43** (turn path + qualificação ZN-0063).

## O que este freeze NÃO é

- Não marca D05 integral nem C001–C008 concluídos.
- Não autoriza voz.
- Não substitui oráculos ZN-0052–ZN-0063 / SPEC-009–010 além da qualificação Zen free documentada.
- Não inventa memória universal nem credenciais geradas por modelo.
