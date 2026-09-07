# Primeiro incremento D01/D02 — execução real

## Escopo e estado

Em 5 de setembro de 2026, a composição local reúne os cinco workspaces com Effect 4, TS7, PostgreSQL 18 e storage S3 compatível real. Uma conta Better Auth normal cria um World privado, importa JSON versionado, compara fontes divergentes, abre evidência e propõe/ confirma uma correção limitada, unknown ou undo. Web e CLI chamam `ApplicationApi` e o mesmo `SemanticExecutor`. `D01Api` conserva o contrato inicial, composto pela aplicação junto às correções.

Este é um incremento funcional. CSV, merge/split de identidade, compartilhamento público do produto, apagamento com supressão de restore, hospedagem Fly e providers externos ainda não estão concluídos. Revogação é exercitada com a membership real no banco do fixture; a operação de compartilhamento ainda será exposta em D03. Nenhuma das 22 entregas ou 157 capacidades recebe conclusão integral por estes resultados.

## Evidências por camada

| Camada | Resultado local | Limite |
| --- | --- | --- |
| Unidade | 173 testes, 20 arquivos | Schemas, JSON estrito, valores, projeção e regras puras |
| Integração | 86 testes, 49 arquivos | PostgreSQL/S3/Better Auth reais; commit, concorrência, isolamento, grants, captura, release, HTTP e processos CLI |
| Componentes Chromium | 7 testes | React real com entradas sintéticas; não prova backend |
| Aceitação Chromium + CLI | 4 testes | Conta normal, duas fontes, evidência, logout/abas/back/revogação, replay entre superfícies, histórico, Stale, unknown e undo |
| Ferramentas de build/provisionamento | 6 contraprovas independentes | Limpeza não atravessa symlinks; credenciais são criadas em modo 0600 sem sobrescrita ou vazamento |
| Build, TS7 e lint | Passaram localmente | Não substituem prova de serviço, navegador ou recuperação |
| Contêiner e CI | Passaram no commit `e13ad12` | Imagem construída, instalação real e 4 cenários de aceitação; não cobre alterações posteriores |

A integração combinada passou sobre `44091d9` (API composta), com Node 24.20.0 e os serviços locais. A primeira execução reunida de navegador passou em 52,2 segundos; a repetição após a composição aditiva da API passou nos mesmos quatro cenários em 51,9 segundos. A CI histórica de bootstrap continua em [33974831478](https://github.com/EnzoTironi/zoen/actions/runs/33974831478); ela não prova as funcionalidades adicionadas depois.

## Revisões e falhas conservadas

- O worker 3 revisou core, grants e identidade; suas contraprovas provocaram correções em prazo SQL, escalada de role, leitura histórica e fronteiras HTTP. O worker 2 revisou storage, CLI e a prova de interrupção do worker 3. O worker 1 revisou correção web e composição operacional de root. As revisões têm recortes próprios; root não aprova sozinho sua implementação.
- A contraprova `bcc10f0`, integrada como `e7f4a5e`, mostrou que um retry de proposta recebia HTTP 200 sem exibir confirmação. As correções `393259f` e `15fef9a` passaram pelo mesmo teste sem alterar suas expectativas. A captura anterior à asserção final mostra renderização intermediária; a asserção Playwright que passou comprova a confirmação visível.
- Os oráculos CLI `c70e870` e `0691a69` mostraram ajuda indevida no stdout quando faltavam flags. `9ca10a7` passou nos dois testes originais: erro JSON no stderr/exit 2, ajuda explícita no stdout/exit 0.
- O teste EX02 antigo rejeitou a alteração de `D01Api`. `44091d9` preservou o contrato inicial e introduziu sua composição aditiva na aplicação. Os 53 testes originais de contrato passaram sem mudança de expectativas.
- A descoberta de aceitação inicialmente selecionava componentes e falhava ao obter a URL. O config atual usa somente jornadas reais, recebe configuração antes da importação e executa um worker. Os testes respeitam a janela real de signup com espaçamento de 10,1 segundos por cenário; o limite do provedor permanece ativo.
- O diretório padrão da suíte de componentes apagou capturas da primeira falha reunida de aceitação; o log da falha permaneceu, mas essas imagens foram perdidas. Ambas as suítes agora usam diretórios irmãos exclusivos por execução. Não se declara preservação das imagens apagadas.
- A limpeza de build inicialmente atravessava um symlink de diretório pai. `4585c0b` conserva três oráculos independentes que falham contra a versão inicial reconstruída e passam com o preflight de todos os destinos antes de qualquer exclusão.
- O build Docker local foi interrompido pela queda do engine, com aproximadamente 100 MB livres no host. Foram removidos somente downloads e ferramentas geradas por esta execução para recuperar espaço; dados SQL/S3, configurações e artefatos admitidos foram preservados. A prova da imagem foi transferida para a CI.

## Processo, release e retenção

A [prova EX15](../../tests/integration/worlds-corrections-independent/README.md) usa processos distintos, lock PostgreSQL observável e SIGKILL. Antes do COMMIT, nenhuma publicação semântica permanece; após o retorno do executor e antes do acknowledgement do harness, o retry recupera exatamente um receipt. S3 pode conservar captura órfã anterior à publicação. Isso não equivale a uma transação distribuída, crash de PostgreSQL/S3 ou exactly-once de efeito externo.

O processo principal verifica o digest admitido e os bytes reais de JS, web, manifests dos workspaces e lockfile antes de abrir pools. A manutenção percorre Worlds e capturas expiradas em páginas limitadas, com a mesma instalação/política e fence de publicação; payload admitido e pin ativo são conservados. Um build novo não pode rebatizar a instalação de Worlds antigos. Artefatos anteriores ficam retidos para suas instalações; upgrade e restore exigem operações próprias.

`pnpm test:container` extrai `release.json` da imagem construída, provisiona um perfil exclusivo, usa o UID do host para ler a montagem de instalação 0600, restringe o container e espera `/ready` real antes de iniciar navegador e CLI. A CLI executada é a do host; o servidor e a web são da imagem. Os logs publicados pela CI excluem arquivos de credenciais, instalação e provisionamento.

## CI completa do incremento JSON

A [execução33984960541](https://github.com/EnzoTironi/zoen/actions/runs/33984960541), commit `e13ad12b881010870570f35e90499f080926d51c`, passou nos cinco jobs, incluindo o agregador obrigatório. O runner executou 173 testes unitários, 86 integrações, 7 componentes Chromium, 6 testes de ferramentas e 4 cenários contra o servidor/web da imagem construída com a CLI do host (56,4s). O caso anterior [33984626649](https://github.com/EnzoTironi/zoen/actions/runs/33984626649) construiu a imagem, mas falhou no verificador de readiness por um reset de conexão transitório; `e13ad12` conservou a exigência de HTTP200 real e passou a esperar também esse erro de transporte dentro do mesmo limite. Essa CI não aprova o incremento CSV nem as mudanças de logout posteriores.
