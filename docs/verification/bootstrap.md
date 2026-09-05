# Bootstrap — evidência por camada

Data: 2026-09-05. Código integrado até `6241437`, macOS arm64, Node 24.20.0, pnpm 11.25.0, TypeScript 7.0.2 e Effect 4.0.0-rc.112. Versões e configuração estão no lockfile e em [toolchain.md](../toolchain.md). Este registro não conclui D01 ou D02.

| Camada | Execução e resultado | Limite da evidência |
| --- | --- | --- |
| Instalação | Instalações congeladas reais em worktrees com dependências próprias | Sem comprovação de build de produto |
| Estática | Oxfmt, Oxlint com análise de tipos e avisos como erro, TS7 strict: zero diagnósticos | Não prova autorização em execução |
| Unidade | 3 arquivos, 67 testes: contratos, portas privadas e apresentação pura | Não são testes de serviços |
| Infraestrutura | 3 arquivos, 4 testes com PostgreSQL 18.6 e RustFS reais | Round-trip SQL/S3, rollback, ausência de DDL no runtime e falhas reais de conexão; não é commit semântico |
| Navegador | 7 testes Chromium sobre componentes React reais | Props sintéticas declaradas; sem backend simulado. Teclado, upload real do input, estados negados, reflow e ampliação CSS de 200%; não é jornada autenticada nem zoom nativo |
| Plano | `python3 tooling/verify_plan.py`: passou | Somente cobertura estrutural, grafo e propriedade de paths; nenhum teste de produto |
| CI remota | [Execução 33974831478](https://github.com/EnzoTironi/zoen/actions/runs/33974831478), commit `d7b6c0e`: quality, unit, integration, components e required passaram | Mesmos 67/4/7 testes em Linux x64; não prova branch protection ou produto completo |

Comandos disponíveis: `pnpm install --frozen-lockfile`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm test:integration`, `pnpm test:components`. Integração carrega `.env.infra` local, ignorado pelo Git, com credenciais geradas para serviços descartáveis. Não copiar valores para logs ou documentação.

Revisão independente: worker-3 revisou a configuração de root e os contratos de worker-1; worker-2 revisou os probes de worker-3; root revisou código, testes e imagens desktop/mobile da UI de worker-2 e executou o conjunto integrado.

Contraprovas preservadas:

- O contrato inicialmente aceitava ano `0000`, rejeitado pelo PostgreSQL. `bcb357b` restringe datas e instantes a 0001–9999; outro worker confirmou os extremos no PostgreSQL real e os testes de regressão no contrato integrado.
- O formulário de correção inicialmente espremia o conteúdo em colunas estreitas. `78f0040` corrige a estrutura responsiva; os testes e imagens do layout corrigido foram inspecionados.
- `Schema.Struct({})` aceitava campos extras no input vazio de genesis. O contrato usa `Schema.Record(Schema.String, Schema.Never)` e contém a contraprova. O agrupamento de erros no HttpApi inicialmente perdia os status; o teste de OpenAPI cobre os membros publicados.
- Os testes de indisponibilidade conectam a portas locais comprovadamente fechadas. Não desligam serviços compartilhados e não transformam falha em sucesso.
- A [primeira CI remota](https://github.com/EnzoTironi/zoen/actions/runs/33974714493) falhou porque setup-node procurava pnpm para cache antes da instalação. `d7b6c0e` desativa esse cache implícito e limita cleanup à configuração de serviços criada; a execução seguinte passou. O agregador required reprovou corretamente a execução anterior.

EX04–EX06 estão em implementação. Auth real, SQL de domínio, captura/admissão, leitura autorizada, CLI, aplicação web conectada, correção, recuperação por crash, imagem e Fly ainda precisam de suas provas correspondentes.
