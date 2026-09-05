# Zoen greenfield: arquitetura, arquivos e execução paralela

Data: 2026-09-05. Análise somente leitura de `/tmp/zoen-review-stack-20260905`. Esta proposta recomeça a implementação; não transforma o código anterior em base a remendar. Nenhuma alteração no repositório, no worktree de rebuild ou em infraestrutura. Não houve deploy nem testes de produto nesta análise.

## Resultado

A dificuldade de paralelizar vem principalmente da granularidade artificial dos entregáveis e da propriedade compartilhada, não da falta de ferramentas de monorepo. O registro contém **2.341 targets**, mas apenas **921 required**; **1.420 são suporte condicional**. Criar todos antes de implementar perpetuaria o problema. Recomendo um monólito modular de autoridade, processos separados por credencial, Effect como infraestrutura de execução e testes organizados por comportamento. Cada pacote novo corresponde a uma fronteira real; cada serviço tem consumidores reais; cada onda fecha uma jornada integrada.

A arquitetura preserva um único executor semântico para UI, Eve, CLI, SDK, MCP e mini apps. PostgreSQL permanece a única autoridade de commit. Door prova presença; autorização, visibilidade e significado pertencem à autoridade. Schemas compartilhados não conferem autorização. Efeito externo, observação e settlement continuam fatos separados.

## Inventário medido e limites da evidência

| Medida | Valor observado |
|---|---:|
| Specs no catálogo | 56 |
| Tickets no catálogo | 325 |
| Targets únicos em files.json | 2.341 |
| Required / conditional-support | 921 / 1.420 |
| planned / implementation-in-progress / candidate-unaccepted / superseded | 1.955 / 365 / 20 / 1 |
| sidecar-only / comment-only-source / existing-with-sidecar / markdown-plan | 843 / 836 / 385 / 277 |
| Arquivos tracked no Git | 3.377 |
| Sidecars tracked `.plan.md` | 1.228 |
| Arquivos tracked `.ts` / `.tsx` | 1.000 |
| Seleção de fontes em runtime-sources.json | 42 |
| Linhas nessas 42 fontes | 10.105 |
| Targets compartilhados por vários tickets / várias specs | 231 / 51 |

Os 42 paths são a seleção declarada de candidatos, não o fechamento transitivo dos imports nem prova de execução. O próprio registro nega qualificação de produção. Há 836 fontes representadas como comentários; contar extensão `.ts` como código entregue produz uma conclusão falsa. O arquivo `transaction.ts` listado tem 1.028 linhas e `dispatch.ts`, 528: no candidato, controle transacional, governança e casos específicos se acumulam em poucos centros. Isso motiva separar responsabilidade no greenfield, sem inferir que divisão textual por si resolve correção.

Distribuição dos targets: tests 881; packages 356; contracts 326; runbooks 325; db 225; apps 76; admissions 40; packs 38; tooling 20; runners 19; infra 17; restante configuração raiz. Em testes: fixtures 331, component 233, migrations 215, journey 38, admission 28, chaos 14, law/laws 14, outras categorias 8. Há 223 targets de migração SQL: isso descreve planejamento antigo, não necessidade de 223 migrações novas.

Gargalos medidos por quantidade de tickets que podem tocar um arquivo:

| Arquivo | Tickets |
|---|---:|
| apps/authority-worker/src/composition.ts | 138 |
| apps/edge/src/composition.ts | 34 |
| pnpm-lock.yaml e execution-lock.json, cada um | 16 |
| surfaces/registry.ts | 12 |
| surfaces/dispatch.ts | 11 |
| apps/eve-worker/src/composition.ts | 10 |

Os locks também confirmam serialização ampla: `schema:authority` aparece em 216 tickets e `composition:trusted-roots` em 186. Lock global pode proteger integridade, mas a solução é diminuir as alterações que realmente o exigem, não apagar o lock nem permitir merges concorrentes de migração.

Foram lidos integralmente o skill Effect e o AGENTS.md do Effect instalado, os quatro contratos de arquitetura solicitados e todos os registros de arquivos/specs/tickets como dados. Foram inspecionados exemplos oficiais locais de SQL, HttpApi e CLI, fonte de SqlClient, adaptador PostgreSQL, executor/commit candidatos e workflows existentes. **Não foi feita revisão semântica individual dos 2.341 planos**, nem auditoria completa de imports ou compilação. Os números de acoplamento acima medem referências declaradas, não todo o grafo real de execução.

## Árvore proposta: diretórios por responsabilidade, criação conforme necessidade

```text
apps/
  server/src/{main,composition,http}.ts
  web/src/{experience,world,apps,studio}/
  eve/src/{main,composition,turns,context}/
  jobs/src/{main,composition}/
  cli/src/main.ts
packages/
  contracts/src/{values,envelope,outcomes,api,operations}/
  authority/src/
    semantic/            # executor, operação admitida, Frame/disclosure, sessões
    commit/              # transação, operação idempotente, guardas e outbox
    access/              # membership, grants, direitos, revogação
    knowledge/           # evidência, identidade, interpretação, stewardship
    governance/          # definições, releases, Cases, mandates
    integrations/        # semântica de fonte, efeito e settlement
    data/                # publicação, captura, flows, datasets, cenários
    lifecycle/           # retenção, erasure, restore suppression
    operations/          # capacidade, células, federação quando necessário
  identity/src/          # presença/Better Auth; sem membership de domínio
  client/src/            # SemanticClient e transportes REST/MCP/app bridge
  connectors/src/        # S3, modelos, canais, providers; I/O fora do commit
  compute/src/           # adapter de runner isolado, apenas quando admitido
ops/
  compose.yaml           # PostgreSQL + S3 compatível reais para dev/CI
  containers/            # builds/restrições por papel
  fly/                   # destino documentado e configuração revisável; sem deploy
  migrations/            # história ordenada, dono exclusivo
  runbooks/              # restore, revogação, Unknown, incidentes, rollout
  admission/             # evidências reais por capacidade/perfil
  observability/         # composição Otlp e política de redaction
packs/                   # dados/IR, criados quando a jornada consome
tests/
  integration/{authority,knowledge,identity,connectors}/
  security/
  acceptance/
  performance/
.github/workflows/{verify,release-check}.yml
```

`tests` aparece fora dos pacotes para testes atravessando fronteiras. Leis puras pequenas podem ser colocalizadas com o módulo. Os nomes ilustram donos e dependências, não exigem um arquivo para cada item entre chaves. Começar com contracts, authority, identity, client, connectors, server, web e CLI; Eve/jobs entram quando sua jornada exige persistência/execução. Compute é futuro, não pacote vazio no bootstrap. Não criar `types.ts`, `ports.ts`, `index.ts`, `service.ts`, `repository.ts` e `.plan.md` automaticamente em toda pasta.

Há aproximadamente oito pacotes/processos concretos necessários para a primeira jornada, não cinquenta e seis serviços. Um orçamento inicial de **80–140 fontes, testes e configurações reais** é apenas uma meta de economia para essa jornada, sem promessa de caber toda a ambição nesse número. Não impor teto que produza arquivos gigantes. O escopo completo cresce por comportamento demonstrado, não por produto cartesiano de tickets e artefatos.

Os paths normativos antigos deverão receber uma alteração arquitetural explícita no novo desenho; mudar `dispatch.ts` para `semantic/executor.ts` muda endereço, jamais multiplica a implementação. A análise não autoriza manter duas árvores ativas.

## Effect: o que usar e o que ainda é domínio Zoen

A referência instalada declara `effect` e drivers `4.0.0-rc.112`. É evidência da referência, não seleção automática da versão do rebuild. Admitir uma combinação coerente Effect 4 RC + driver + plataforma + vitest e fixá-la no lock. TS7 é o único compilador: comandos e plugins precisam ser verificados contra seu executável real, sem depender de um fallback TS5/TS6.

| Necessidade | Recurso Effect observado localmente | Trabalho específico que continua necessário |
|---|---|---|
| Valores e fronteiras | Schema, Schema.Class, Schema.TaggedError | World/realm, dinheiro decimal, intervalos, erros públicos indistinguíveis, rejeição de autoridade no JSON |
| Dependências e lifecycle | Context.Service, Layer, Scope, acquireRelease | Menor conjunto de credenciais por processo; a tipagem não impede rede/SQL por si |
| Execução e cancelamento | Effect.fn, Effect.gen, NodeRuntime.runMain, Layer.launch | Prazos, orçamento, finalização e política de falha do produto |
| HTTP e cliente | HttpApi, HttpApiBuilder, HttpApiClient, HttpApiMiddleware | Contexto verificado, executor único e checagem final de disclosure |
| SQL | @effect/sql-pg, SqlClient.withTransaction, SqlSchema, migrator | SERIALIZABLE, locks ordenados, complete read set, idempotência, fencing, commit+receipt+outbox |
| Modelos SQL | Model.Class com variantes | DTO público explícito; variante JSON não pode serializar automaticamente todas as colunas |
| Fluxos e filas | Stream, Queue/PubSub, Schedule | Revogação por emissão, limites, gaps, cursor atual, persistência em PostgreSQL |
| Clientes externos | HttpClient e adapters de SDK quando necessários | Qualificação do provider, resultado Unknown, nenhum I/O dentro de autoridade SQL |
| CLI | effect/unstable/cli | Comandos sobre SemanticClient; nenhum executor de negócios alternativo |
| Telemetria | logs, spans, métricas, módulos Otlp | Allowlist de atributos; nem payload privado nem Basis interno no trace |
| Testes | @effect/vitest, Scope/TestClock quando aplicável | Postgres/S3/policy/browser reais e testemunha independente de invariantes |

Não reconstruir scheduler de fibers, container DI, parser de CLI, framework HTTP, registrador genérico de efeitos, biblioteca de retries ou runtime de testes. Também não instalar cluster/workflow/eventlog como segunda autoridade só porque existem: disponibilidade de uma API não estabelece a semântica exigida. Streams e PubSub não são fila durável. `withTransaction` não declara sozinho SERIALIZABLE nem prova ausência de provider calls. Redacted não garante a não interferência de metadados. Exemplos oficiais de mocks/in-memory HTTP não substituem integração real exigida aqui.

`ManagedRuntime` só na borda inevitável de biblioteca imperativa e uma instância por composição apropriada; a aplicação principal já pode usar Layer.launch. O novo servidor pode usar HttpApi/HttpRouter diretamente: Hono não é necessário para encapsular uma API que Effect já oferece. Better Auth pode exigir uma ponte especializada, mas continua dono de presença, sem réplica de membership/autorização.

## Contratos estáveis que destravam os agentes

Congelar primeiro cinco interfaces pequenas e documentar propriedades, erros e exemplos reais de serialização:

1. **Contracts:** envelope estrito, operação liberada, scalars, resultados e DTO de disclosure; separar `InternalBasis` de representação pública autorizada. Campos internos, revisões, cut, digests e cobertura também podem revelar alterações ocultas. Não devolver um hash global opaco como suposta solução: sua mudança observável ainda pode vazar atividade oculta.
2. **Identity:** PresenceProof obtido de sessão/workload verificado. Somente composição confiável produz o contexto final. Acesso a World ainda requer admissão atual pelo executor.
3. **AuthorityCommit:** recebe intenção canônica estável, escopo, guardas completos, plano tipado de mudanças permitidas; executa unicamente trabalho SQL sob credencial de autoridade. Erros de serialização permitem no máximo três retries sem renovar consentimento/basis. O efeito transacional não depende de HTTP/modelo/S3. O plano não é SQL fornecido por cliente nem texto arbitrário executável.
4. **SemanticExecutor/SemanticClient:** executor recebe contexto confiável e operação validada; cliente transporta a mesma união de operações. Handles, Frame, sessões e cursores são referências, nunca grants. Validar novamente antes da emissão/replay/download.
5. **Provider ports:** aquisição/staging/execução/observação usam schemas concretos e erro explícito. Persistir intento/outbox antes do envio, lease/fence na execução, reconciliar Unknown. Não declarar sucesso por timeout ou ack de transporte.

Manter `packages/contracts` e `packages/client` separados do backend reduz o risco de imports de credenciais em bundles e permite cliente/UI progredirem após estabilizar a interface. Custo: mais exports e configuração do que pasta única. Concentrar a autoridade em um pacote evita dezenas de versões internas, mas exige disciplina de imports e donos por subdiretório.

Não colocar todas as operações em um gigantesco arquivo compartilhado. Schemas específicos ficam em `contracts/src/operations/<família>.ts` com dono único; o dono de contracts mantém só o envelope e uma lista explícita curta. Cada família exporta seu conjunto de handlers Layer, consumido por uma composição fina. O executor implementa o pipeline uma vez; handlers implementam somente a semântica da família. Não criar autodiscovery dinâmica, decorators ou codegen de módulos para evitar um import.

## Propriedade exclusiva e paralelismo

Uma onda deve reservar **paths concretos**, não apenas um nome de spec. O mesmo agente pode assumir dois papéis numa onda pequena; dois agentes não escrevem o mesmo path ao mesmo tempo.

| Dono | Escrita exclusiva | Dependência para começar |
|---|---|---|
| platform/integrator | manifests, lockfile, composição dos apps, workflows, ops exceto migrations | decisões da stack |
| contracts | envelope/values/api e contratos acordados | invariantes e operações da onda |
| identity | packages/identity e testes de presença | PresenceProof |
| authority | commit/access/lifecycle, migrações e testes de transação | contratos de commit |
| knowledge | authority/knowledge e testes correspondentes | contracts + commit |
| executor | authority/semantic e testes de conformance | contratos executor/commit/disclosure |
| releases | authority/governance | commit + operações liberadas |
| integrations-domain | authority/integrations | commit + provider ports |
| connectors | packages/connectors e testes contra providers reais | provider ports |
| data-domain | authority/data | publication/capture/retention contracts |
| compute | packages/compute e perfis de isolamento | broker/lease/output contracts |
| client | packages/client, CLI | contracts/HttpApi |
| web | apps/web | client + DTO autorizado |
| eve | apps/eve | client + journal/turn contract |
| packs | packs da onda | IR liberado |
| assurance | tests/security, acceptance/performance independentes | testemunhas e interfaces congeladas |

Essa tabela descreve lanes possíveis ao longo do produto, não quatorze agentes simultâneos nem necessidade de criá-los agora. O plano operacional comporta **orquestrador + três workers (quatro slots), todos GPT-6-Astra low**, inclusive revisão. Na primeira onda: worker A contratos/identidade; worker B infraestrutura/SQL; worker C testemunhas puras/CI. Depois de congelar os seams: worker A commit/executor; worker B cliente/UI; worker C evidência/conectores. O orquestrador possui exclusivamente composição, manifests, lock e integra a onda; revisão independente roda com um worker que não implementou o bloco, após concluir sua escrita. Propriedade se transfere explicitamente entre ondas, nunca por concorrência implícita. Para GPT-6-Astra low, usar pacotes de trabalho com um resultado observável, 3–8 arquivos próprios normalmente, interfaces importáveis, comando de validação direto e falha esperada. Tickets que exigem compreender todos os 325 anteriores estão grandes demais. Não predeterminar minúsculos tickets por método; isso aumenta custo de integração.

O integrador altera uma composição apenas ao integrar uma família concluída, com imports reais e teste da rota. Agentes entregam arquivos/exports próprios; não enviam múltiplas edições concorrentes de composition.ts. Migrações recebem números finais sequencialmente pelo dono SQL depois da revisão do DDL, mantendo a ordem de dependências; não renumerar migrações já aplicadas. Contratos congelados podem evoluir com adição compatível; quebra reinicia somente dependentes afetados. Contratos fictícios com implementações stub que retornam sucesso são proibidos.

QA revisa propriedade e testemunhas sem aprovar o próprio trabalho. Leis puras e testes de módulo pertencem ao implementador; a lane assurance mantém as provas cruzadas independentes. `file-disposition.json` concentra os targets antigos de testes em assurance para triagem: isso **não** exige um único escritor para todo novo teste. O backlog greenfield deve repartir testes de módulo aos donos acima, mantendo somente segurança/jornadas independentes com assurance.

## Ordem de composição recomendada

- **Fundação:** lock coerente TS7/Effect4/Ultracite, comandos diretos, Docker PG+S3, contrato de presença, envelope, roles e primeiras migrações. Contracts, infraestrutura e testemunhas podem progredir em paralelo após a decisão da stack.
- **Primeira jornada:** presença → genesis pelo commit comum → fonte/evidência real → claim → Frame autorizado → mesma leitura por UI e CLI. Mudança em World oculto não altera payload, Basis público, contagens ou erros visíveis. Nenhuma dependência de LLM para leitura tipada.
- **Uso contínuo:** grants/revogação, Cases/guardas, retomada, mini app declarativo, conversa/Eve sobre o mesmo cliente, outbox e recuperação. Workers entram com credenciais próprias, não com accesso geral ao pool de autoridade.
- **Ampliação governada:** definições/releases, packs, efeitos, providers/canais e mandates. Cada recurso externo tem sua admissão própria; indisponibilidade de um provider não bloqueia trabalho independente.
- **Capacidades avançadas:** datasets, captura live, flows, compute/isolamento, enterprise/cells/federation/offline e domínio financeiro. Cada uma mantém as mesmas leis; não antecipar engines que a jornada atual não consome.

Essa sequência é arquitetural; não elimina capacidades C001–C157 nem substitui a matriz de requisitos que o roadmap deverá manter.

## Turborepo, CI e infraestrutura

**Não adicionar Turborepo no bootstrap.** pnpm workspace, TS7 e scripts diretos já permitem executar tarefas independentes. Turbo não resolve o arquivo tocado por 138 tickets nem SQL compartilhado. Adotá-lo somente após medir repetição de builds e um grafo estável que permita cache correto; registrar tempo frio/quente e benefício real. Caso adotado, cache de lint/typecheck/build com inputs explícitos; integração, migração, revogação, caos e admissão sempre rodam contra serviços reais. Sucesso cacheado de outro perfil não prova comportamento neste commit/DB/provider. Nenhuma dependência de Turbo para a semântica de execução.

O CI antigo extrai um único ticket do título do PR e chama um verificador próprio. O greenfield deve verificar a mudança real e sempre executar um núcleo completo relevante:

1. Instalação frozen e validação da stack admitida. TS7 sobre todo código executável/importável, sem whitelist runtime-sources. Ultracite/Oxlint com type-aware + type-check e denyWarnings, Oxfmt cobrindo todas as fontes reais, com **zero avisos e zero erros**. Configuração verificada contra a versão admitida, sem afirmação de sucesso baseada em parser de saída frouxo.
2. Grafo/imports e bundles: cliente/web/Eve não alcançam SQL de autoridade, secrets ou adapters privilegiados; verificar reachability/credenciais também em runtime. Compiler e lint sozinhos não provam isolamento.
3. Leis reais de scalars, comparação, canonicalização e guardas. Resultados não vazios, sem skip/todo/only. Suites de integração com Postgres e S3 de Docker, migração vazia/upgrade, roles e constraints; nenhuma conexão privilegiada substituindo o papel de produção.
4. Testemunhas de commit atômico, concorrência/idempotência, phantom/range guards, revogação antes da emissão e pares de Worlds com diferenças apenas ocultas, incluindo metadados Basis. S3 staging/publicação/retention testados no componente real; nenhuma URL bearer pública para objeto privado.
5. Browser/CLI sobre servidor real para a jornada da onda, sem mock do backend; testes de payload/erro/consequência equivalentes entre superfícies. Serviços externos indisponíveis ficam bloqueados explicitamente; CI local pode concluir apenas o subconjunto que efetivamente provou.
6. Build dos artefatos/processos reais, varredura de dependências/secrets e imagem, inventário de rotas privadas/assets/downloads/upgrades. Chaos/carga/restore executam em workflow apropriado e retornam evidência da versão/perfil; não se chamarão aprovados por lint verde.
7. Um status obrigatório agrega jobs exigidos sem aceitar skipped como passado; artefatos guardam commit, lock, configuração, comando, resultado e saídas sanitizadas. A própria coleta não é um novo framework de execução. Release-check produz artefato revisável e critérios; não faz deploy nesta tarefa.

Docker local/CI usa PostgreSQL e uma implementação S3 compatível realmente disponível e admitida (a referência usa perfil RustFS, mas nome do perfil não qualifica sem execução). Fly é o destino do desenho, sem copiar Terraform AWS/pilot por inércia. A topologia mantém processo web/server, Eve e jobs separados quando suas credenciais exigem. Local PG+S3 não certifica HA, backups ou single-writer failover em Fly. Definir restore, fencing, segredos e rede antes de admitir hospedagem. Não resetar dados anteriores: arquivo histórico, inventário de produção, migração e cutover são questões distintas.

## Disposição completa de arquivos

O JSON acompanhante tem **uma entrada para cada um dos 2.341 targets originais**, valida unicidade e registra hash do registro analisado. Resultado: **296 rewrite; 1.944 consolidate; 79 retain-intent; 22 retire**. Cada entrada contém dono/módulo proposto, justificativa, regra aplicada, specs/tickets originais, allocation e indicador de seleção runtime.

A classificação é feita por regra explícita e exceções de propriedade, não por leitura linha a linha de todos os planos. Exemplos: contratos JSON e matrizes de fixtures/runbooks são consolidados; tooling de pseudocódigo é retirado; templates Terraform antigos são retirados da árvore ativa; suas exigências de segurança permanecem em requisitos/admissões. SQL é consolidado para nova história, nunca apagado de uma base em uso. Packs preservam intenção como dados. Fontes candidatas são reescritas ou consolidadas, não copiadas como aceitas.

`required_new_file=false` em todas as entradas significa que o registro antigo não obriga criar aquele path no greenfield. Não significa cancelar seus requisitos. O próximo backlog deve ligar cada requisito preservado a uma operação, arquivo real quando necessário e prova da camada correta. Nenhum arquivo gerado de pseudocódigo, suite vazia, bloqueio artificial de ticket ou número total de arquivos serve como substituto dessa prova.
