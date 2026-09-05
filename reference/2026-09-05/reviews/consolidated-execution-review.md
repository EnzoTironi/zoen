# Atualização do parecer após correções — 2026-09-05

**Resolvidos no planejamento os três achados P2 e o drift P3. Não resta impedimento identificado nesta revisão para iniciar o bootstrap e produzir EX02.** A avaliação abaixo permanece como registro da primeira leitura; esta atualização é o parecer vigente.

- **Schema SQL:** EX02 agora possui `outputs`, `owns` e `persistence_handoff` para `docs/contracts/d01.md`, com tabelas/colunas/chaves/tipos, locks/guards/roles, produtor e consumidores explícitos. O handoff exige revisão antes das queries EX05 e do DDL EX06. Resolvido.
- **Entrypoints:** EX11/EX12 possuem `integrator_steps` de root, disparados pelo candidato `implemented_unverified` com EX10 disponível, antes de aceitar o pacote e sem esperar EX14. `integration_assistance_rule` explicita o fluxo. Os paths dos subpassos estão cobertos pela reserva de root. Resolvido.
- **Política de upload:** EX02 define perfil resolvido pelo servidor; EX08 agora exige recusa de requisitos incompatíveis e possui checks reais para zero evidência admitida, pins/GC e staging. Linhagem/cópias não ganham suporte independente. Resolvido no plano, ainda não implementado.
- **Drift:** tabela EX03 exige EX01, EX05 identifica executor único, EX08 usa SqlClient e o texto deixou de sugerir a porta SQL removida. Resolvido.

Revalidei o DAG combinado `hard + acceptance_requires`: **15 nós, sem ciclos**. A nova assistência de integração não adiciona dependência reversa de aceitação. Os documentos continuam marcando comandos/provas como planejados.

**Pendências normais de execução, não regressões do plano:** `docs/contracts/d01.md` ainda não existe; agora é um output claramente atribuído a EX02 e deve ser produzido/revisado antes de iniciar seus consumidores. Ligar os comandos planejados às suítes reais, incluindo as testemunhas de navegador, no bootstrap. O vínculo EX→requisitos/IDs de catálogo permanece uma melhoria de rastreabilidade sugerida, sem perda dos mapas integrais já verificados. Nenhum desses itens equivale a produto ou teste já aceito.

---

# Revisão da execução consolidada

2026-09-05. Revisão somente leitura de `/Users/enzotironi/zoen-rebuild`: `planning/execution.json`, `deliveries.json`, `ticket-map.json`, `capability-map.json`, `spec-map.json`, `file-map.json`, `docs/execution.md` e `docs/invariants.md`; referências pontuais a `architecture.md` e `quality.md` para resolver interpretação. Nenhum arquivo da consolidação foi alterado. Esta revisão não verifica produto nem versões atuais das bibliotecas.

**Resultado: o grafo e a rastreabilidade de catálogo estão consistentes; ajustar três handoffs de execução antes de despachar seus consumidores.** Não encontrei ciclo formal, disputa de ownership entre workers, capability apagada dos mapas ou comando planejado falsamente apresentado como existente. Há divergências editoriais e alguns contratos/integrações cujo dono global existe, mas o pacote responsável pelo handoff não está explícito.

## Achados

### 1. P2 — Acordo do schema SQL é consumido, mas não aparece como entrega explícita de EX02

Referências: `planning/execution.json`, EX02 (linha 126), EX05 (267), EX06 (321).

EX06 consome “schema mínimo acordado em EX02”. EX05 implementa commit/acesso em paralelo a EX06 e usa diretamente SqlClient. Entretanto, EX02 define schemas transportáveis e portas storage/presença; seus outputs, aceitação e allowlist não explicitam o acordo físico de tabelas/colunas/constraints/ordem de locks consumido pelas consultas de EX05. EX06 detém o SQL candidato, enquanto EX05 só precisa de EX06 para aceitação, não para início.

Isso é uma lacuna no handoff, não ausência de dono para SQL: W2 possui o DDL e W1 possui a semântica. Sem um acordo concreto inicial, ambos podem implementar queries/schema incompatíveis e descobrir o conflito apenas na integração.

**Correção sugerida:** antes de escrever queries de EX05, registrar um schema mínimo acordado entre EX05/EX06 e aprovado por root, com tabelas/chaves/constraints usadas na primeira jornada. Pode ser artefato de design curto em EX02, sem wrapper transacional; ou permitir EX05 começar apenas partes puras e exigir EX06 para iniciar a parte SQL. Manter o parallelismo das partes independentes. Root continua único dono do numbering.

### 2. P2 — Conexão dos entrypoints web/CLI é necessária para EX11/EX12, mas aparece explicitamente apenas antes dos componentes existirem ou depois da aceitação deles

Referências: EX01 `owns`, EX10 (linha 508), EX11 (565), EX12 (610), EX14 (705).

EX11 e EX12 só aceitam após processo/browser reais e dizem que root conecta entrypoints. EX10 compõe o server, mas não possui `apps/web/src/main.*` nem `apps/cli/src/main.*` e não explicita a instalação inicial dos clientes. EX01 possui esses paths, mas é aceito antes da implementação dos clientes. EX14 volta a possuí-los, porém depende de EX11/EX12 já concluídos.

Não é ciclo do DAG atual: a regra global de root permite fazer o trabalho entre pacotes. É uma dependência operacional escondida que o dispatcher não consegue obter apenas de `owns` e dos critérios de conclusão.

**Correção sugerida:** declarar em EX10/uma obrigação de integração root o hookup inicial dos clientes **quando os candidatos EX11/EX12 estiverem prontos, antes de sua aceitação**, incluindo allowlist desses entrypoints. Separar explicitamente “server integrado EX10” de “root conectou cliente candidato”; não adicionar uma aresta EX10→EX11 completo, pois isso criaria ciclo. A alternativa é autorizar uma etapa contínua de integração de root, como prerequisito nomeado de aceitação do cliente, sem novo pacote ou framework.

### 3. P2 — Restrição de política de dados do primeiro upload não foi materializada na aceitação de EX02/EX08

Referências: `docs/invariants.md:40`; EX02; EX08 (`planning/execution.json:411`).

A invariante exige política de dados conhecida/cumprível e recusa de dados que exijam apagamento ainda indisponível. EX08 verifica durabilidade, staging e cleanup, mas não explicita uma entrada/schema de perfil de dados, a checagem que recusa perfil incompatível nem sua prova negativa. O `invariant_contract` global preserva a obrigação normativa; não a elimina. Falta torná-la executável na primeira admissão, em vez de esperar que cada worker deduza a mesma política.

**Correção sugerida:** EX02 define a representação mínima do perfil de dados realmente habilitado; EX08 recebe a responsabilidade explícita de verificar compatibilidade antes de admitir e testar rejeição de perfil incompatível. Não transformar isso em novo sistema genérico de admissão e não chamar retenção/apagamento completos de entregues. Uma política inicial concreta restrita e cumprível basta, com escopo publicamente honesto.

### 4. P3 — Drift entre tabela de execução e JSON, e menção residual a porta SQL

- `docs/execution.md:47` informa `—` como integração adicional de EX03; JSON EX03 contém `acceptance_requires: ["EX01"]`.
- EX05 no JSON agora se chama “Executor único, commit/access e genesis” e possui `semantic/**`; a tabela ainda descreve apenas commit/access/genesis, omitindo a nova responsabilidade principal.
- EX08 `contracts_consumed` ainda diz “portas SQL e storage EX02”, embora a regra consolidada exija SqlClient/driver Effect sem port transacional genérico.
- `docs/execution.md:61` ainda justifica EX05/EX06 pelas “portas estáveis EX02”; convém trocar por schemas/acordo SQL e serviços Effect reais para não sugerir a abstração removida.

A seção final do documento declara que o JSON consolidado prevalece, portanto a regra correta pode ser recuperada. Mesmo assim, a tabela é a superfície provável de leitura ao despachar e deve refletir o contrato vigente. Correção textual pontual, sem alterar o DAG.

## Observações não bloqueantes

**Traces param no nível de entrega, não de incremento EX.** Os mapas relacionam perfeitamente ticket→spec/capability/delivery e arquivo histórico→ticket/spec. `execution.json` não possui campos `ticket_ids`, `requirement_ids` ou `delivery_ids` por pacote. Isso não perde nenhuma capability, mas impede calcular mecanicamente quais requisitos foram exercidos pelo incremento EX01–EX15 e quais seguem pendentes dentro de D01/D02. Recomendo um vínculo pequeno por pacote aos requisitos efetivamente exercidos, com `partial` quando necessário; não copiar todos os 975 checks para EXxx.

**`planned_commands` precisam receber seleção concreta no bootstrap.** EX03 descreve inspeção de navegador, mas só lista `test:unit -- EX03`; EX12 descreve Playwright, mas lista `test:integration -- EX12`. Pode haver configuração válida que execute esses checks, mas o runner ainda não existe e a separação de camadas em `quality.md` atribui browser/CLI ao comando de aceitação. Na implementação, explicitar a suíte invocada por cada comando e garantir que as testemunhas de navegador realmente executem. O texto já proíbe seleção vazia e declara comandos indisponíveis, portanto **não há alegação falsa de comando existente**.

**O verificador independente está corretamente separado.** W3 não aprova a própria CLI/storage/valores; W2 revisa essas peças e as testemunhas de EX15. W3 revisa core/UI/composição. A integração root mantém revisão por W3. O fluxo merece ser mantido.

## Verificações realizadas e resultados

| Verificação | Resultado observado |
|---|---|
| Pacotes EX únicos | 15 |
| DAG combinando hard + acceptance_requires | 15 nós ordenados, sem ciclo |
| DAG de dependências obrigatórias das entregas | 22 nós ordenados, sem ciclo |
| Ownership cross-worker | Nenhuma interseção encontrada entre globs dos diferentes workers/root; os paths compartilhados por pacotes sucessivos pertencem ao mesmo root |
| Modelo dos workers | GPT-6-Astra low; root sem override |
| Workspaces | Cinco, conforme árvore consolidada |
| Tickets únicos/mapeados | 325 |
| Capabilities mapeadas | 157 |
| Specs mapeadas | 56 |
| Entradas de arquivo histórico | 2.341; classificação por regra explicitamente declarada |
| IDs referenciados em tickets/caps/specs/files | Zero referências órfãs nos campos de rastreabilidade examinados |
| `delivery_ids` das caps/specs versus união dos destinos dos tickets associados | Igualdade em todas as 157 capabilities e 56 specs |
| Capstones transversais | ZN-0281–0286 e ZN-0325 apontam para Q; Q aplica às 22 entregas |
| C062/C064 | Ambas P2; conclusão integral não reivindicada em P1 |
| Comandos/testes | Todos os pacotes permanecem `planned`, `verification_state=not_run`; interface de comandos a criar explícita |
| SqlClient e executor | Regra direta do Effect e executor comum presentes; um vestígio textual de porta SQL listado acima |

As verificações de glob foram conservadoras sobre os padrões declarados, não prova de ausência de futura colisão num filesystem ainda não implementado. Dependências condicionais não foram tratadas como arestas obrigatórias porque seu próprio contrato exige refinamento por perfil; isso evita classificar integração condicional mútua como ciclo formal de entrega.

## Recomendação

Corrigir os handoffs de schema SQL, conexão inicial dos clientes e perfil de dados do upload antes de despachar os pacotes afetados. Atualizar a tabela/strings residuais junto dessas correções. O inventário e o DAG não precisam ser refeitos: a consolidação preserva rastreabilidade e as mudanças necessárias são pequenas, explícitas e locais ao plano inicial.
