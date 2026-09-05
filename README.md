# Zoen — redesenho para execução

Este branch contém o redesenho solicitado em 5 de setembro de 2026. O objetivo continua sendo um sistema em que pessoas, Eve, apps e integrações trabalham sobre a mesma verdade, com evidência, direitos e consequências explícitas. A execução passa a começar por uma jornada útil e crescer por entregas verificáveis.

**Estado: implementação em andamento.** A primeira jornada já executa autenticação real, criação de World, importação JSON/CSV, inspeção com evidência e correção/unknown/undo em web e CLI sobre PostgreSQL e S3. O proprietário também pode conceder e revogar leitura do World. As provas de [D01/D02](docs/verification/d01-d02-local.md), [CSV](docs/verification/csv-local.md) e [compartilhamento](docs/verification/sharing-local.md) registram revisão independente, integração, navegador e interrupção de processo. As entregas completas ainda exigem expansões. O [progresso atual](planning/progress.json) é distinto do plano original.

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

## Executar o incremento local

Com Node da versão em `.node-version`, pnpm de `package.json`, Python 3 e Docker disponíveis, em um checkout novo:

```sh
pnpm install --frozen-lockfile
pnpm build
python3 tooling/prepare_infra.py
docker compose --env-file .env.infra -f ops/compose.yaml up -d --wait
pnpm provision:local
pnpm start:server
```

Abra `http://127.0.0.1:4310` e crie uma conta normal. Em outro terminal, execute a aceitação contra esse servidor:

```sh
ZOEN_TEST_WEB_URL=http://127.0.0.1:4310 \
ZOEN_TEST_CSV_WEB_URL=http://127.0.0.1:4310 \
ZOEN_TEST_SHARING_WEB_URL=http://127.0.0.1:4310 \
pnpm test:acceptance
```

`pnpm cli --help` apresenta os comandos. O JSON admitido está especificado em [D01](docs/contracts/d01.md), e o dialeto CSV em [seu contrato](docs/contracts/d01-csv.md). CSV exige seleção explícita na web ou `import --format csv` na CLI. Compartilhamento exige o UUID da conta destinatária e confirmação da audiência de leitura de todo o World. O perfil aceita somente dados cuja retenção sem apagamento possa cumprir; não habilita dados sensíveis, hold ou prazo legal.

Os dois provisionadores recusam sobrescrever arquivos existentes. Para reiniciar o mesmo build, basta subir os serviços e executar `pnpm start:server`. Uma versão nova usa `ZOEN_LOCAL_PROFILE=<nome>` em `provision:local`, `start:server` e `test:acceptance`, criando banco, papéis e bucket próprios. Isso não migra Worlds anteriores. Cada instalação verifica os bytes do build admitido antes de abrir conexões; preserve seu artefato e seus dados até existir um upgrade qualificado.

`pnpm test:container` constrói a imagem real, provisiona uma instalação pelo manifesto extraído dela e executa a mesma aceitação contra seu servidor/web, com a CLI compilada do host. A imagem usa porta 4313 durante o teste. Logs ficam em `.local/*-proof/`; configurações, banco e bucket são preservados localmente. A CI usa volumes descartáveis próprios. A prova em contêiner não é deploy Fly nem recuperação de dados apagados.
