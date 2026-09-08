# D05 Eve — congelamento mínimo do primeiro incremento (EX40+)

Status: **decisões mínimas congeladas por root em 2026-09-07 (PT)** a partir de `docs/roadmap.md` (D05), `docs/invariants.md` (INV-01), `docs/architecture.md` (journal operacional) e capacidades C001/C002/C006/C007/C008. Atualizado no mesmo dia para admitir **OpenCode Zen free** como caminho de texto quando a key estiver presente, e **Web Speech API** como caminho de voz no browser (ZN-0063). Isto **não** declara D05 concluído, **não** cria processo `packages/eve` separado e **não** corta o app legado `zoen`.

Fonte tip de partida (stub): `644d400`. Tip Zen live: ver `docs/verification/eve-opencode-zen.md`. Tip voz: ver `docs/verification/eve-web-speech.md`.

## Congelado agora (mínimo executável)

| ID | Decisão | Efeito |
| --- | --- | --- |
| F01 | Eve é **cliente semântico** com **estado de relacionamento**; identidade prova presença e autoridade concede direitos de domínio. | INV-01: journal/conversa **não** importam nem recebem credencial da base de autoridade **nem** a API key OpenCode. |
| F02 | Superfície do incremento = **chat textual** com fatos admitidos, incerteza explícita, cancelamento e journal recuperável; voz browser é I/O sobre o mesmo turn path. | C001/C002/C007 no escopo mínimo; composição grounded cita evidência ou declara unknown/partial. |
| F03 | Journal único de interação é a fonte de retomada; ordem de conversa/turnos é preservada após falha do worker. | Recover sem re-chamar o modelo; stream provisório ≠ mensagem visível settled. |
| F04 | Resumos/compaction **não** viram evidência nem autoridade factual. | C006: compaction só contexto; fatos continuam nos refs de evidência/claims. |
| F05 | **Voz = Web Speech API** no `@zoen/web` (`eve-web-speech-v1` / `web-speech`): STT `SpeechRecognition` + TTS `speechSynthesis`. Sem cloud STT/TTS inventado; OpenCode Zen não tem modelos de voz. `voice-blocked` permanece literal fail-closed para tentativas não qualificadas. | Transcript → turn texto (Zen) → speakText; APIs ausentes → Unavailable/Blocked honestos. |
| F06 | **OpenCode Zen free** é o candidato de **texto**; a **key sozinha não admite** o produto (ZA-17). Sem journal durável + grounding + aceitação de perfil (ZA-18/19/20), a composição instala `blockedProvidersLayer` + `blockedLayer` — `Blocked`/`Unavailable` honestos, nunca stubMemory/live como substituto. | Smoke Zen documentado em `docs/verification/eve-opencode-zen.md` não é admissão de produto. |
| F07 | Perfil texto grounded: `eve-opencode-zen-v1` / `opencode-zen` (aceitação estreita ZA-20); voz `eve-web-speech-v1` / `web-speech`; `eve-local-stub-v1` / `stub-local` **somente** proofs offline de unidade — **removido da composição de produto** (ZA-17). Aceitação de perfil ≠ D05 ativado. | Worlds/`DataPolicy` intactos; stubMemory não é journal durável. |
| F08 | Paths de domínio: `eve/**`, `conversation`, `journal`, `evidence`. | Sem pastas/arquivos/funções novas `D0x`/`d0x`; `D05` só como id de entrega/roadmap/título de freeze. |
| F09 | Ferramentas/efeitos cruzam a fronteira semântica idempotente; Eve não é pré-requisito de leituras estruturadas. | Structured calls seguem independentes (SPEC-009 refinement). |

## Honestidade pós-ZA-17

Composição de produto **não** ativa Eve com `stubMemoryLayer` nem Zen live só porque a key existe. Worlds/web/CLI centrais continuam usáveis; rotas Eve autenticadas devolvem `Blocked`/`Unavailable` explícitos até provas ZA-18/19/20. Incerteza `Known` exige base de evidência autorizada — comprimento de prosa do modelo nunca é input epistêmico.

## Ainda bloqueado (gates antes de D05 integral)

| Gate | Por quê |
| --- | --- |
| Cloud STT/TTS (OpenAI/etc.) | Sem keys no inventário; fora deste incremento — Web Speech cobre I/O browser. |
| Máquina de turnos completa (leases CAS, tool dispatch, streaming prod) | EX posteriores após provider live. |
| Processo separado Eve com credenciais mínimas | Architecture: só quando o produto admitir Eve runtime. |
| Cutover legado `zoen` / DNS | D04 hosted; fora de Eve. |
| Compaction durable / multi-provider routing | C006/C008 além de Zen free. |

## Pacotes EX

Ver `planning/execution.json`: **EX40** (freeze + schemas) → **EX41** (journal recoverability) → **EX42** (OpenCode Zen client) → **EX43** (turn path + qualificação Zen) → **EX44** (Web Speech voice profile + qualificação ZN-0063 voz).

## O que este freeze NÃO é

- Não marca D05 integral nem C001–C008 concluídos.
- Não inventa cloud STT/TTS nem credenciais de voz.
- Não substitui oráculos ZN-0052–ZN-0063 / SPEC-009–010 além das qualificações Zen free e Web Speech documentadas.
- Não inventa memória universal nem credenciais geradas por modelo.
