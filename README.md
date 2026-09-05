# Zoen — redesenho para execução

Este branch contém o redesenho solicitado em 5 de setembro de 2026. O objetivo continua sendo um sistema em que pessoas, Eve, apps e integrações trabalham sobre a mesma verdade, com evidência, direitos e consequências explícitas. A execução passa a começar por uma jornada útil e crescer por entregas verificáveis.

**Estado: implementação em andamento.** A base Effect 4/TS7, os contratos do primeiro incremento e os componentes web têm provas locais. Executor, persistência de domínio e autenticação ainda estão em construção; D01 não está concluído. A [evidência do bootstrap](docs/verification/bootstrap.md) separa testes de componentes, integração e CI. O [progresso atual](planning/progress.json) é distinto do plano original.

Foram analisadas as 325 entradas do catálogo, as 56 specs nele contidas, as 157 capacidades e os 2.341 alvos do registro de arquivos. Isso cobre os registros integralmente; não equivale a revisar semanticamente cada arquivo de pseudocódigo ou a aceitar a implementação anterior.

- [Roadmap e decisões de escopo](docs/roadmap.md): seis fases, 22 entregas e dependências de produto.
- [Leis do produto](docs/invariants.md): 24 invariantes preservadas e contratos mínimos para a primeira composição.
- [Arquitetura](docs/architecture.md): cinco workspaces iniciais, Effect 4 e um único executor.
- [Execução com subagentes](docs/execution.md): GPT-6-Astra low, três workers, propriedade de arquivos e primeiras ondas.
- [Qualidade e CI](docs/quality.md): TS7, Ultracite, serviços reais e prova por camada.
- [Auditoria e rastreabilidade](docs/audit.md): limites da análise, destinos de todos os itens e validação do plano.

Os detalhes executáveis das primeiras tarefas estão em [planning/execution.json](planning/execution.json). O restante permanece em entregas com resultados e critérios claros; arquivos e tarefas são detalhados quando seus contratos se tornam estáveis. Não serão recriados milhares de arquivos de plano vazios.

Os PRs da pilha anterior foram fechados. O histórico foi preservado em Git e em bundle externo; o trabalho novo está isolado em `codex/rebuild`. `archives/` permanece histórico imutável. Os registros em `reference/2026-09-05/` são entradas históricas da análise, com hashes; não são instruções ativas.

O branch de implementação é publicado para executar a CI real, sem deploy ou alteração de dados de produção. Integrações externas continuam exigindo contas, APIs e evidências reais para ativação.
