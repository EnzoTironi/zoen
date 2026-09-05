# Roadmap greenfield por resultados — proposta de projeto

Data: 2026-09-05. Referência somente de leitura: `/tmp/zoen-review-stack-20260905`. Foram examinados os 56 registros de specs do catálogo, seus protocolos/dependências, os 157 registros de capacidade, a constituição, o contrato do executor e os resultados/gates dos 12 milestones. Este relatório não certifica implementação, provedores ou desempenho. Não altera o repositório e não transforma decisões propostas em contratos aprovados.

## Decisão central

Recomeçar a implementação não deve recomeçar a descoberta das garantias. Preservar os 24 invariantes e todas as capacidades C001–C157 como intenção final; substituir o caminho S0–S11 por seis fases de resultado com gates por capacidade. A unidade de entrega será uma jornada utilizável com suas provas, não um arquivo, camada ou número de checks.

O primeiro produto útil é uma pessoa acompanhar e corrigir compromissos domésticos a partir de arquivos próprios: importar duas fontes, distinguir previsto/faturado/pago, ver evidência e lacunas, corrigir um item com escopo e desfazer, fechar a sessão e reabrir sem perder o resultado. Isso entrega organização e confiança sem modelo, WhatsApp ou instituição financeira. Não chama uma declaração de pagamento de liquidação bancária. A escolha doméstica é proposta de foco inicial, não exclusão de confeitaria, clínica ou instituição.

Um único executor recebe web, CLI, agente, SDK, MCP e apps. Postgres é autoridade; object storage real preserva bytes. Effect 4 organiza efeitos/recursos e composição; TypeScript 7 é o único compilador admitido; Ultracite sem violações e CI obrigatórios. Versões exatas, compatibilidade e digests precisam de evidência real antes de execução: não preencher um lock hipotético ou introduzir TS6 como fallback. Docker local executa serviços reais; Fly é destino do piloto, condicionado à qualificação concreta. A escolha AWS de SPEC-039 é substituída como default, sem retirar residência, isolamento ou recuperação da ambição.

## Seis fases e seus resultados observáveis

| Fase | Resultado de produto | Critério visível e gate objetivo | Quando um componente faltar |
|---|---|---|---|
| P1 — Organizar e corrigir com confiança | World privado, entrada real, arquivos textuais/CSV/JSON, compromissos domésticos mínimos, evidência, interpretação, correção/undo e leitura web/CLI | Uma jornada real no navegador e CLI produz a mesma interpretação/receipt; duas sessões isoladas; concorrência cria um só resultado; mudança de leitura invalida correção pendente; revogação barra replay; reinício preserva admissão; apagar e restaurar não ressuscita payload. Postgres e store reais; revisão independente. | Fonte externa ausente aparece como lacuna. Nenhum mock. Sem ferramenta de login admitida, o gate de uso privado fica bloqueado; não há usuário privilegiado de desenvolvimento. Arquivos autorizados continuam sendo fontes genuínas. |
| P2 — Usar em equipe e conversar | Piloto Fly, compartilhamento restrito, pergunta/resposta útil, conversa grounded, confeitaria operacional e clínica administrativa restrita; uma integração escolhida por demanda | Convidar, restringir e revogar em voo; resposta humana atribuída; pergunta obsoleta rejeitada; contexto e busca não contêm evidência oculta; falha de stream é explícita; fonte real qualificada ou rota bloqueada; backup/restore/erasure e limites medidos para o piloto. | Sem modelo, a aplicação estruturada continua útil. Sem OAuth/conta de fonte, upload e web continuam. Não afirmar conversa, conector ou piloto Fly admitido sem teste real. |
| P3 — Adaptar o trabalho sem novo deploy | Definições/regras/apps declarativos e packs governados; Studio inicial; API/CLI/SDK/MCP gerados; cenários de leitura | Usuário altera uma definição, vê diferença/consequência, avalia isoladamente e publica a geração exata; política vigente aprova; Case aberto recebe disposição explícita; cenário gera novo Case vivo; mesmo significado nas superfícies; sem JS/SQL gerado em autoridade. | Editor limitado aos operadores realmente implementados. Operação ausente fica indisponível. App declarativo opera sem Rivet, runner ou marketplace. |
| P4 — Agir e delegar com limites | Ações externas reais, mandatos, reservas, reconciliação de Unknown, notificações e canais qualificados | Um provedor real executa uma ação autorizada; timeout depois do envio não causa repetição cega; reserva permanece no Unknown; cancelar intenção não finge cancelar o efeito; filho não excede orçamento; revogação impede nova tentativa; destinatário e consentimento rechecados. | Proposta/local Case pode ser inspecionado, mas envio é bloqueado e assim rotulado. Não marcar sucesso do provedor nem liberar reserva por timeout. Web e Notices locais independem de WhatsApp/email. |
| P5 — Estender e operar dados em escala | Extensões isoladas, apps executáveis, dados densos/CDC/live, compute, conectores enterprise, SSO e controles institucionais | Host/runner real resiste a artefato adversário; leases/recall funcionam; publicação aponta snapshot exato com pins; gaps/ACL/deletes propagam; deprovisionamento revoga trabalho; recuperação e carga medidas; conta/contrato de cada provedor qualificados separadamente. | Sem isolamento admitido, código de terceiros permanece desligado; app declarativo segue. Sem licença/feed/GPU, rota permanece bloqueada, sem simular integração. Não requer todas as extensões para admitir uma já provada. |
| P6 — Coordenar ecossistemas e completar a ambição | Marketplace comercial, mobilidade/federação/offline/self-hosted/fleet, finanças até custódia e aceitação integral | Fencing real impede dois escritores; cortes federados e parciais explícitos; lease offline expira honestamente; contratos de self-hosted comprovados; fills/busts/cancel/clearing/custódia separados; licenças/supervisão reais; revisão de 157 capacidades sem lacunas escondidas. | Parte financeira pode mostrar apenas dados que possui direito de usar; sem custódia observada, liquidação permanece desconhecida. Perfil não qualificado não recebe selo completo. |

P1 não é um framework universal de 48 tickets antes da primeira tela. O caminho interno mais curto é: composição/serviços reais → uma identidade real e World privado pelo commit comum → uma admissão/evidência → uma Frame simples web/CLI → divergência e correção guardada com undo → reinício/revogação/apagamento/restore. São incrementos da mesma jornada. Cada incremento é integrado cedo; P1 só é admitida quando o conjunto está comprovado.

P2–P6 não são barreiras globais artificiais. Uma qualificação WhatsApp em P4 não bloqueia o início de P3; finanças de referência podem avançar após a semântica e direitos necessários, sem esperar offline. Fase identifica onde a entrega completa planejada é agrupada. Garantias transversais valem a partir da primeira operação que depende delas. O JSON associado explicita versões iniciais e expansão; não declara uma capacidade ampla completa por entregar seu subconjunto.

## Garantias que estavam atrasadas ou presas à dependência errada

**Case, correção e questionamento.** SPEC-005 admite correção em S0, SPEC-006 fala em Cases de identidade em S1 e SPEC-017 organiza perguntas em S2, mas SPEC-022 só define a ação consequencial em S4, dependendo de Watches/retenção. Proposta: extrair conceitualmente o Case mínimo compartilhado para P1, mantendo seu proprietário único. Intenção, tipo da resposta, escopo, revisão, basis de leitura, ator, consequência, estado e receipt são suficientes para correção. Aprovação de proprietário único é um perfil real do mesmo mecanismo, não bypass. Quorum, consequência externa e mandato expandem o mesmo Case depois. Question é uma solicitação versionada de esclarecimento ligada à ambiguidade/Case; Answer é assertion, identity resolution, instance decision, rule proposal ou preference. Uma resposta não instala regra. Uma opção desconhecido/dispensar não é voto. Mudar candidatos, direitos, identidade ou regra invalida pergunta/revisão aplicável. Pergunta simples pode ser apresentada em P1; a priorização e stewardship completa chega em P2, sem exigir um modelo ou compiler universal.

**Retenção e fresh start.** Capturar bytes primeiro e só definir apagamento em S3 é perigoso operacionalmente. P1 precisa do inventário real de payloads/derivados criados, política por artefato, referências/pins, ledger de supressão, leitura indisponível e restore fechado. Não implementar antecipadamente limpeza de embeddings inexistentes; quando um novo derivado surgir, sua entrega exige participar do mesmo inventário. Fresh start de conversa, sessão e World são operações distintas. Nova conversa não apaga evidência; logout não apaga World; novo World não migra grants; apagar conteúdo não apaga automaticamente receipt permitido. Propor UI separada para essas intenções, confirmação consequencial e estados pendente/bloqueado/concluído por artefato. Recomeçar o repositório não autoriza resetar bancos, backups ou evidência anterior. Hold conflitante bloqueia a eliminação e pede revisão humana; não escolher prazo legal presumido.

**Relógios e freshness.** Clock não é apenas um adaptador de testes: validade, tempo conhecido, deadline de Case, expiração de grants e retenção não são o mesmo relógio. P1 modela Instant/Date/wall time, corte de conhecimento, freshness por fonte e avaliação da expiração no commit. Tempo de processo serve para duração; autorização usa tempo de autoridade admitido. Proposed default: fonte sem SLA declarado tem freshness desconhecida, não verde; salto de relógio ou confiança insuficiente bloqueia ações sensíveis à expiração e expõe motivo. Testar com relógio explícito e barreiras dentro do componente real; não usar sleeps frágeis como prova. Offline P6 exige suas próprias hipóteses de expiração e nunca herda validade infinita por estar desconectado.

**Coverage e qualidade.** C022/C044 não podem esperar integração enterprise. A primeira tela informa fontes esperadas/declaradas, presentes, rejeitadas, atrasadas e cobertura desconhecida. Uma fonte faltante não é zero; ausência de registro não é tombstone. Qualidade tri-state começa na admissão inicial, lineage começa na transformação CSV. A infraestrutura CDC/lake amplia essas garantias, não as inventa. Uma porcentagem de completude exige denominador confiável; sem ele, mostrar dimensão desconhecida.

**Direitos e descoberta.** World privado não elimina direitos: fonte, propósito, audiência, sessão, evidência e derivado já precisam de interseção e revogação. Aplicar antes de seleção, ranking/agregação e explicação desde P1. Suporte a times/delegação e política fina em P2 amplia cobertura pelo mesmo authorizer. SSO/SCIM, residência dedicada e Federação são expansão enterprise; segurança de disclosure não é. Retirar a cadeia SPEC-018 → SPEC-017 → modelo/compilador como requisito do authorizer mínimo. Engine Cedar, se mantida no contrato, deve ser real; troca por política própria seria mudança explícita de contrato, não otimização silenciosa.

**Recuperação e limite de recursos.** P1 já precisa de atomicidade/receipt/outbox, idempotência, redaction, shutdown e restore; piloto real adiciona envelope medido, quotas conservadoras e runbook. HA institucional e migração entre células são P5/P6. Não vender RPO/RTO não medidos. Proibir treino entre clientes desde o primeiro uso de modelo; não aguardar marketplace.

## Dependências a reconstruir como DAG de capacidades

- Presence adapter → commit/World schema → genesis: preservar a quebra do ciclo SPEC-002/003 já reconhecida, não criar outro motor de bootstrap.
- Claims/Frames/Case mínimo/rights/retention formam a composição P1; não dependem de Eve, WhatsApp, regra runtime geral, Watches ou source OAuth. Definições iniciais são image-pinned, explicitamente limitadas; compiler runtime entra em P3.
- SPEC-012 onboarding deve depender da jornada semântica e host acessível, não de SPEC-011 WhatsApp. SPEC-049 piloto não deve herdar essa dependência. Links privados também não dependem de canal.
- SPEC-022 local separa seu contrato de SPEC-020 Watches e SPEC-023 providers. SPEC-023 perde a dependência obrigatória de WhatsApp; o canal é apenas um possível efeito.
- SPEC-025 busca autorizada não precisa de Mandates (SPEC-024); agentes especializados precisam. SPEC-026 transporte simples não precisa de retrieval/modelo. Generation de superfícies precisa do manifest real e do executor, não de um agente.
- SPEC-016 domínio inicial não precisa de OAuth/runtime integration. Pack sem ação externa mantém seu estado indisponível para comprar/enviar, sem segundas regras de negócio.
- SPEC-031 dados densos não deve exigir execução arbitrária só porque usa um worker: worker confiável, delimitado, e runner de código hostil têm admissões diferentes. SPEC-032 lineage/quality/checkpoint é anterior ao lake; CDC sofisticado chega quando a fonte exige.
- SPEC-037 packs declarativos não dependem de notebooks/GPU/marketplace. Registro mínimo acompanha P3; assinatura/reputação comercial amplia depois.
- SPEC-041 cada recipe depende de sua API e garantias reais. Google/CRM via API não depende necessariamente de SCIM, warehouse, CDC ou runner custom.
- SPEC-045 master financeiro e point-in-time não devem depender de federation/offline. C148–C150 podem desenvolver-se após rights/time/evidence; operação financeira e licenças continuam gated. C152 exige base/FX/risk apropriados, não presença arbitrária de todo compute stack.
- SPEC-048/055 aceitação é contínua por incremento e capstone final por ambição; não descobrir igualdade de superfícies, privacidade ou carga apenas no fim.

Essa reconstrução muda tickets, dependências e escopo das fatias, mas não permite enfraquecer invariantes. Cada extração exige contrato reescrito e evidência de composição, sem citar a antiga sequência como aprovação.

## Tecnologia e integrações: obrigação versus escolha substituível

Obrigatórios pela direção atual: Effect 4 corretamente composto, uma toolchain TypeScript 7, Ultracite com zero violações e checks CI, Postgres e object storage reais no Docker, destino Fly, uma autoridade. Confirmar suporte técnico por lock e spike executável na execução; este relatório não consultou versões de provedores e não afirma compatibilidade atual.

Adiar instalação até haver consumidor: Restate para durable orchestration externa, índice vetorial, Lakekeeper/Iceberg/DuckDB, filas/feeds dedicados, runner gVisor/microVM, GPU, Rivet e infra enterprise. Postgres outbox/attempts não é segundo reconciliador: é estado do único domínio de efeitos. A eventual adoção de Restate não transfere autoridade ao orchestrator. Docker normal serve Postgres/store de desenvolvimento; não prova contenção de código hostil.

AWS deixa de ser destino padrão. Fly precisa demonstrar persistência, rede/segredos, rollout/migrations, backup/store consistency e restore; nomes de produto não são prova. A possibilidade futura de AWS é uma decisão de portabilidade empresarial, não dependência do piloto. Rivet é candidato de adapter para backend especializado; ausência/rejeição não tira app declarativo do ar. WhatsApp/Kapso, Telegram, email, modelos, SSO, fontes licenciadas e brokers têm gates por conta/API/escopo. Nenhuma licença ausente pode ser substituída por dados de provedor inventados. Arquivos autorizados e dados sintéticos inseridos em Postgres/store reais são admissíveis como dados de teste, sem representar integração qualificada.

## Decisões propostas antes de novos tickets

1. Adotar compromissos domésticos como primeira jornada, com confeitaria e clínica administrativa em P2. Se outro público liderar, trocar o vocabulário do primeiro pack, preservando o motor.
2. Fixar P1 como single-region, World privado e operações image-pinned; P2 admite times e piloto; compiler completo é P3. Isso é redução temporária de exposição e reordenação, não corte da ambição.
3. Definir a política explícita de retenção do piloto com o responsável pelos dados. Proposta técnica inicial: órfãos não admitidos elegíveis para limpeza após 24h; nenhuma fonte sem política admitida entra com dados sensíveis; prazo de conteúdo legítimo não é adivinhado. Hold sempre prevalece até revisão; metadados remanescentes devem ser minimizados.
4. Propor limites iniciais mensuráveis: 10 MiB por arquivo, 5 arquivos por admissão, 200 linhas por página, 1 MiB por resposta, 30s por chamada síncrona. São defaults de projeto a validar, não capacidade provada; exceder retorna limite explícito. Não fingir truncamento completo.
5. No piloto, zero provider effects/autonomia em background até P4; Notices locais e decisões locais já podem funcionar. Prazo vencido nunca estende autorização silenciosamente.
6. Escolher somente um modelo, um conector de alto valor e um provedor de ação para as respectivas primeiras admissões. Multirroteamento e outros canais ficam identificados no inventário até seus testes reais.
7. Resolver explicitamente o conflito de tecnologia AWS/Fly, a dependência exclusiva TS7 e a antecipação do Case na documentação normativa antes de gerar trabalho implementável. Ausência de TS7/Effect4 compatível é bloqueio objetivo para o trecho dependente, não licença para outra stack.
8. Fixar evidência independente e autoridade de aceitação. Autor e agente podem implementar e relatar testes, mas não autoaprovar a entrega nem inventar resultados.

## Como substituir microtickets sem perder controle

Ticket novo deve entregar comportamento observável pelo executor: usuário/ator, intenção, início/fim, invariantes, contrato de entrada/saída, fontes/operating profile, cenário de falha reproduzível, prova de camada correta, allowlist/locks e integração real. Por exemplo, “corrigir um compromisso e desfazer sem alterar outros” inclui handler, persistência, UI e provas; não vira quatro tickets artificialmente independentes que deixam o fluxo incompleto.

Seis primeiras unidades sugeridas: (1) criar/reabrir World real e negar outro sujeito; (2) admitir arquivo e inspecionar sua evidência após restart; (3) comparar duas fontes sem confundir predicados; (4) corrigir/desfazer com guards e impacto; (5) apagar payload e provar supressão após restore; (6) realizar a jornada acessível web/CLI com revisão independente. Composição, toolchain e harness são pré-requisitos pequenos de execução, não uma fase paralela infinita de plataforma.

Paralelismo máximo útil significa workstreams independentes sobre contratos pequenos já acordados: kernel puro, composição de serviços, UX/host e especificação de oráculos podem caminhar juntos; schema/commit compartilhado tem um dono. Após base estável, frontend/CLI e extração podem avançar em paralelo usando serviços reais. Jobs de provedor admitem-se à parte; seus bloqueios não param arquivos/web. Nenhum agente deve inventar interfaces para ocupar capacidade. Este relatório não iniciou agentes adicionais nem implementações.

## Rastreio completo

O arquivo `capability-disposition.json` contém exatamente uma entrada por C001–C157, preservando o nome original, fase da entrega completa planejada, entrega inicial/expansão, disposição e motivo. `reordenar_e_preservar` não significa implementado. Nenhuma capacidade é excluída. A troca AWS → Fly é mudança de escolha tecnológica proposta/autorizada pela direção atual, e não remoção de C133–C147. Retirar WhatsApp/Rivet como pré-requisitos é reordenação/desacoplamento; removê-los da intenção final exigiria mudança de escopo explícita, que não é proposta aqui.

Abaixo, todas as 56 specs têm destino. Uma spec pode atravessar fases porque sua unidade antiga mistura garantia e expansão.

### Contratos internos propostos concretamente

Estes defaults resolvem o desenho interno para permitir tickets executáveis; não se solicita ao humano inventar o protocolo. Devem passar pela revisão normativa comum antes da implementação, pois este trabalho é análise.

- **Case mínimo:** `kind`, `revision`, `intentDigest`, `scope`, `actor`, `expectedBasis`, dependências de leitura, consequência e estado explícito; a correção e o undo passam pelo mesmo propose/answer/commit. Undo é nova decisão que aponta a anterior e revalida o mundo atual, não reversão cega de linhas. Reutiliza receipt e outbox do commit único.
- **Question:** aponta o Case/ambiguidade e a versão do conjunto de candidatos; armazena tipo de resposta permitido, destinatário autorizado, prazo e status. Reply não vigente retorna stale e não confirma a versão atual silenciosamente. Perguntas podem funcionar em formulário sem Eve.
- **Coverage incompleta legítima:** `expectedSources`, `admittedSources`, `gaps`, qualidade e freshness são dimensões distintas. Sem inventário completo declarado, completude é unknown. É legítimo entregar leitura parcial rotulada; é inválido derivar zero/ausência ou permitir uma ação cuja pré-condição exige cobertura total.
- **ClockSample local não é snapshot:** uma amostra de relógio informa instante/qualidade/incerteza do relógio da autoridade e avalia expiry/deadline; ela não certifica que toda fonte estava atual naquele instante. A base transacional conserva cuts/versões das fontes e da projeção separadamente. Sources precisam de observação/freshness próprios. Testes mudam o relógio e as fontes independentemente para provar que não são confundidos.
- **Basis privado versus Frame público:** o servidor retém basis completo de guards, epochs e revisões necessário para stale checks; o cliente recebe apenas referências opacas e cortes/proveniência autorizados. Contadores globais ou digests que mudam devido somente a atividade oculta não entram automaticamente no payload. O token não deve ser derivado publicamente de um contador secreto; resolução e comparação ocorrem no executor. Resultados stale/denied e metadados de cursor também passam por não interferência. Pares de Worlds que diferem apenas em dados ocultos devem produzir a mesma observação permitida, incluindo erro, tamanho lógico e contagem; a garantia não é uma promessa de ausência universal de side channel temporal de infraestrutura.
- **Pins desde upload:** staged/quarantined/admitted/deletion-pending/unavailable são estados distintos. A autoridade só admite referência após durabilidade real e proteção de retenção apropriada; GC não elimina objeto preso por admissão em curso ou referência vigente. Supressão de leitura precede coleta física; policy/hold impede coleta quando exigido. P1 implementa isto no object store real, sem instalar Iceberg para preservar um CSV.

| Spec | Tema original | Destino proposto |
|---|---|---|
| SPEC-000 | Execution baseline, dependency admission and fail-closed CI | P1 — composição real, lock, TS7/Effect4, Ultracite e CI; qualificar extensões quando usadas |
| SPEC-001 | Kernel values, contract algebra and canonical encoding | P1 — valores, tempos e resultados puros usados pela primeira jornada |
| SPEC-002 | Door, World genesis and fresh purpose-bound entry | P1 presença/genesis/owner; P2 convites/delegação; P5 enterprise |
| SPEC-003 | Atomic authority, domain guards and durable handoff | P1 — commit/guards/idempotência/outbox único, sem executor de bootstrap paralelo |
| SPEC-004 | Retained evidence and file-based source admission | P1 — captura/pins/retention e arquivos; P2 extração rica qualificada |
| SPEC-005 | Comparable claims, interpretations and scoped correction | P1 — interpretação/correção/undo guardados; P3 regras runtime |
| SPEC-006 | Reversible domain identity and temporal explanations | P1 — namespace/ambiguidade; P2 merge/split reversível |
| SPEC-007 | WorldFrames and the first semantic surface | P1 — executor e Frame autorizado; futuras superfícies reutilizam |
| SPEC-008 | Baseline observability, local operations and safe migration preparation | P1 — observabilidade/restore/supressão; legado exige inventário e não reset |
| SPEC-009 | Eve fenced turn machine and visible-message recovery | P2 — turn machine após structured product, sem bloquear onboarding |
| SPEC-010 | Context, grounded composition, model routing and voice | P2 — modelo/contexto; P4 voz completa com provedor qualificado |
| SPEC-011 | WhatsApp durable ingress, consent and secure continuation | P4 — canal opcional por gate; P2 continuação web independente |
| SPEC-012 | Progressive onboarding and accessible conversation inspection | P1 — host acessível/onboarding; P2 conversa e teste com públicos |
| SPEC-013 | Bounded ontology grammar and deterministic release compiler | P3 — compiler bounded; P1 operações image-pinned suficientes à jornada |
| SPEC-014 | Runtime change governance, evaluation, preparation and activation | P3 — governança runtime; P1 Case local já governado pelo perfil vigente |
| SPEC-015 | Source inventory, OAuth bindings and declarative integration plans | P1 inventário; P2 primeiro conector; P3 mappings runtime; P5 estate |
| SPEC-016 | Foundation, household and confectionery domain packs | P1 doméstico mínimo; P2 packs operacionais; P3 instalação; P4 ações delegadas |
| SPEC-017 | Clarification prioritization and scoped stewardship | P1 pergunta/answer mínimos; P2 priorização; P3 rule teaching governado |
| SPEC-018 | Fine-grained rights, delegation and audience-safe disclosure | P1 rights de owner/fonte/disclosure; P2 compartilhamento fino; sem depender de Eve |
| SPEC-019 | Retention, erasure, legal holds and restore suppression | P1 retenção/apagamento/restore dos artefatos reais; P2 revisão de hold; ampliação contínua |
| SPEC-020 | Semantic Watches, Notices and quiet attention | P2 Watches/Notices locais; P4 entrega em canais com política atual |
| SPEC-021 | Dental operations pack with clinical separation | P2 clínica administrativa isolada; P4 responsabilidade delegada; gate clínico específico |
| SPEC-022 | Released Actions, approvals and accountable local decisions | P1 Case/correção/decisão; P3 quorum/runtime actions; P4 external effects |
| SPEC-023 | Effect execution, provider evidence and honest settlement | P4 — provedor real, durable attempts e reconciliação; independente de WhatsApp |
| SPEC-024 | Budget conservation, bounded Mandates and observed outcomes | P4 — mandatos, budgets e observação; limites básicos de recurso desde P1 |
| SPEC-025 | Authorized retrieval and permitted specialized agents | P2 busca autorizada/grounding; P4 agentes; P5 vector admission |
| SPEC-026 | REST, CLI, TypeScript SDK and MCP from one manifest | P1 web/CLI mínimos; P3 geração completa; não depende de Mandates/retrieval |
| SPEC-027 | Living World charts, tables, timelines and safe Focus | P1 tabela/evidência; P3 charts declarativos; P5 densidade medida |
| SPEC-028 | Telegram, email and cross-channel continuity | P4 — Telegram/email reais; nenhuma identidade presumida por transporte |
| SPEC-029 | Signed capability artifacts and controlled installation | P5 — artefato/instalação/recall; não requisito para pack puramente declarativo |
| SPEC-030 | Isolated runners, credential brokers and programmable analysis | P5 — código hostil somente em isolamento real qualificado |
| SPEC-031 | Dense Parquet/Iceberg datasets and atomic publication | P5 — dense snapshots/pins; pins de objetos simples já existem em P1 |
| SPEC-032 | Governed batch, incremental, CDC and stream data flows | P1 qualidade/lineage inicial; P2 checkpoints; P5 flows/CDC/stream |
| SPEC-033 | Entitled live feeds, gap-aware subscriptions and action capture | P5 — feed qualificado e captura exata antes de ação |
| SPEC-034 | Virtual sources and distributed/GPU compute adapters | P5 — virtual/compute por contrato real, fora de autoridade |
| SPEC-035 | Progressive Workshop: early declarative apps, isolated views and full Studio | P3 — Workshop declarativo; P5 Studio completo sobre componentes já entregues |
| SPEC-036 | Read-only scenarios, notebooks and evaluated model artifacts | P3 — cenários e Case vivo; P5 notebooks/modelos avaliados |
| SPEC-037 | Pack registry, overlays, upgrades and marketplace governance | P3 — packs/overlays/upgrades; P6 marketplace comercial |
| SPEC-038 | Enterprise SSO, SCIM and workload identity lifecycle | P2 — identidade de workload/delegação se necessária; P5 SSO/SCIM real |
| SPEC-039 | Dedicated regional cells, private networking and recovery | P2 Fly piloto; P5 células/HA/keys privadas; trocar default AWS explicitamente |
| SPEC-040 | Fairness, economics, capacity admission and audited support | P1 limites; P2 quotas/suporte/carga piloto; P5 capacidade institucional medida |
| SPEC-041 | Enterprise source recipes and domain-wide reconciliation | P2 primeira recipe real por valor; P5 estate e domain-wide reconciliation |
| SPEC-042 | Fenced cell migration and single-writer authority epochs | P6 — fencing/migração; single-writer já obrigatório desde P1 |
| SPEC-043 | Federated Frames, independent approvals and partial global outcomes | P6 — federação/partial independent cuts, sem bloquear finanças locais |
| SPEC-044 | Offline child scopes, self-hosted equivalence and fleet policy | P6 — offline/self-hosted/fleet qualificados; Docker local não é essa certificação |
| SPEC-045 | Finance security master, corporate actions and licensed information | P6 — finance reference/licensing; desenvolvimento após P1/P2 sem federação obrigatória |
| SPEC-046 | Market data, portfolio analytics and pre-trade risk | P6 — market/risk com base/entitlement; não obriga GPU se cálculo admitido local basta |
| SPEC-047 | Orders, executions, allocations, custody and supervision | P6 — execução até custódia com provedores reais e lifecycle distinto |
| SPEC-048 | Full-ambition integration, adversarial assurance and final acceptance | Todas as fases — capstones por resultado; P6 aceitação integral dos 157 |
| SPEC-049 | Shared hosted pilot and progressive product activation | P2 — Fly piloto com backup/erasure/limites; sem channel/enterprise gate global |
| SPEC-050 | One semantic executor and transport-only client contract | P1 — único executor em composição real, expandido sem serviços semânticos duplicados |
| SPEC-051 | Authority-free continuation links and scoped application sessions | P2 — links e sessões privados; P3 app ceilings; não depende de WhatsApp |
| SPEC-052 | Early declarative mini apps as released data | P3 — app declarativo liberado, sem runtime executável/Rivet |
| SPEC-053 | Isolated app host and transport-only bridge | P5 — host de código hostil separado e bridge somente transporte |
| SPEC-054 | Rivet Dynamic Apps Core qualification and immutable runtime adapter | P5 — Rivet candidato qualificado/rejeitado explicitamente; não substrate obrigatório |
| SPEC-055 | Cross-surface equivalence, adversarial app journeys and capacity | P1 web/CLI parity; P3 declarativo; P5 host real/capacidade; P6 auditoria integral |
