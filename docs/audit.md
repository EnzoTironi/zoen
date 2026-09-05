# Auditoria do redesenho

## Universo examinado e limites

Foram processados integralmente o catálogo de 325 tickets com suas 56 specs, dependências, oráculos, locks e artefatos; o registro das 157 capacidades; e as 2.341 entradas únicas de arquivos propostos. Os relatórios independentes dos três subagentes GPT-6-Astra low sustentam o redesenho. O orquestrador reconciliou as divergências e verificou cobertura e dependências por script.

Isso é uma análise integral **dos registros**, acrescida de leituras dirigidas dos contratos, candidatos e ferramentas relevantes. Não houve leitura semântica individual dos 2.341 pseudoplanos nem revisão dos 325 documentos separados. A classificação de arquivos usa regras explícitas e exceções. Não foi executada a aplicação nova; testes antigos não foram reutilizados como aprovação do novo desenho.

## Diagnóstico

| Observação no catálogo anterior | Implicação para o redesenho |
|---|---|
| 325 nós, 514 arestas, nenhuma referência inválida e nenhum ciclo | O problema não era um DAG formalmente cíclico |
| Uma raiz e caminho mais longo de 170 nós | Muito trabalho precisa atravessar uma longa cadeia declarada; isso não estima dias |
| 286 arestas ao ID imediatamente anterior; 261 na mesma spec | Sinal de ordenação por catálogo, a revisar semanticamente; não prova de que todas são artificiais |
| 118 arestas transitivamente redundantes | Removê-las limpa o grafo, mas sozinha não reduz a ordem parcial ou seu caminho crítico |
| `schema:authority` em 216 tickets e `composition:trusted-roots` em 186 | Locks globais longos anulam o paralelismo; reservar só a escrita realmente compartilhada |
| Composição referenciada por 138 tickets; 231 alvos compartilhados | Um dono de integração e módulos exclusivos evitam três agentes disputando o mesmo arquivo |
| 921 arquivos obrigatórios e 1.420 condicionais | O registro não autorizava tratar todos os 2.341 alvos como scaffolding obrigatório |
| 975 checks, 457 textos de oráculo distintos; um BOUNDARY repetido 133 vezes | Contagem de IDs não mede testes independentes nem comportamento provado |

Exemplos concretos da revisão: ZN-0030 exige Frame antes de sua implementação planejada; ZN-0049 exige supressão no restore antes do ticket correspondente; onboarding depende de voz/canal sem necessidade; receitas de fontes distintas estão encadeadas; algumas funções financeiras dependem de federação sem usá-la. Esses casos foram tratados reorganizando recortes de produto, não apagando uma aresta sem revisar sua semântica.

## Mapas completos

- [Tickets](../planning/ticket-map.json): uma entrada por ID, disposição, entrega, dependências antigas a reconsiderar e referências aos oráculos originais.
- [Capacidades](../planning/capability-map.json): uma entrada por capacidade, fase completa planejada, tickets/specs e entregas que contribuem. Todas preservadas.
- [Specs](../planning/spec-map.json): uma entrada por spec com destinos derivados dos tickets; uma spec pode atravessar entregas.
- [Arquivos](../planning/file-map.json): uma entrada por alvo, disposição, módulo/dono proposto, regra aplicada e relações históricas. Nenhuma entrada obriga recriar o path antigo.

Disposição dos tickets: 242 implementações a consolidar, 47 obrigações de teste, 19 critérios de ativação, nove requisitos transversais, sete duplicações a consolidar e uma migração condicional. Disposição dos arquivos: 296 reescritas, 1.944 consolidações, 79 intenções preservadas e 22 retiradas da árvore ativa. Retirar arquivo/ferramenta não apaga seu requisito nem autoriza apagar dado em uso.

Os mapas apontam para os registros históricos, que conservam os 975 oráculos e o texto das 56 specs. Cada novo pacote escolhe cenários concretos relevantes dessa fonte; não afirma equivalência semântica completa por associação de IDs. Capacidades compartilhadas por muitos tickets precisam de aceitação conjunta no perfil habilitado.

## Preservação e autoridade

Os snapshots de entrada têm commit e SHA-256 em [reference/2026-09-05/manifest.json](../reference/2026-09-05/manifest.json). Relatórios dos agentes ficam em `reference/2026-09-05/reviews/` como material de análise; divergências são resolvidas pelos documentos consolidados em `docs/`. Em particular, a proposta inicial de oito workspaces foi reduzida para cinco; capstones antes atribuídos administrativamente a D22 foram movidos para Q.

O branch `codex/rebuild` é independente do checkout original. A pilha antiga foi encerrada preservando branches, commits e o bundle `/Users/enzotironi/zoen-history-20260905/pre-restart.bundle`; não foi apagado conteúdo de produção nem feito cutover. A ausência de inventário verificado de produção continua desconhecida, não equivale a base vazia.

## Validação do plano

Execute `python3 tooling/verify_plan.py`. O script verifica hashes dos snapshots, conjuntos e unicidade de IDs, referências dos mapas, DAG de entregas/tarefas, prerequisitos, dono de paths e conflitos entre tarefas concorrentes. O resultado é [planning/validation.json](../planning/validation.json), capturado novamente depois da revisão independente.

Essa validação prova consistência estrutural e rastreabilidade do plano. Não prova comportamento, segurança, integração externa ou desempenho. Revisão humana/agente ainda é necessária para julgar se uma dependência ou cenário faz sentido; essas conclusões estão nos documentos e pareceres.

## Fechamento da revisão independente

As releituras dos três agentes confirmaram resolução dos achados documentais: leis ativas, genesis/idempotência, journal operacional delimitado, retenção antes do piloto, publicação runtime governada, contrato físico SQL, integração dos clientes e política de admissão de dados. Os pareceres preservam os achados iniciais e sua resolução. Nenhuma revisão aprova código futuro.

Cada EX inclui `source_ticket_ids` e `required_read` para reduzir o contexto ao recorte pertinente. Contratos a produzir em EX02 são outputs explícitos, não arquivos alegadamente existentes. O bootstrap pode iniciar; consumidores aguardam os contratos reais.
