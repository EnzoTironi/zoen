# Toolchain executável

Versões fixadas no lock: Node 24.20.0, pnpm 11.25.0, TypeScript 7.0.2, Effect e drivers 4.0.0-rc.112, Ultracite 7.10.8, Oxlint 1.81.0, Oxfmt 0.66.0. Vitest 4.1.11 respeita os peers de `@effect/vitest` e Better Auth; Vitest 5 não é uma combinação admitida neste bootstrap.

Instalação: Node da versão em `.node-version`, depois `pnpm install --frozen-lockfile`. O `prepare` aplica o patch oficial `@effect/tsgo` ao compilador e ao linter. `msgpackr-extract` executa seu instalador nativo explicitamente permitido; não há aprovação ampla de scripts de dependências.

`pnpm format:check`, `pnpm lint` e `pnpm typecheck` cobrem todas as fontes, configurações e testes reais. Snapshots históricos, dependências, lock gerado e resultados binários têm o tratamento indicado na configuração; não são uma whitelist de módulos aceitos.

## Compatibilidade verificada dos presets

Foram reproduzidos estes conflitos antes de ajustar a composição dos presets. As decisões se aplicam a categorias de linguagem/runner e continuam sujeitas à revisão independente. Não há supressões inline ou exceção para ignorar um arquivo com erro.

| Regra | Conflito observado | Tratamento |
| --- | --- | --- |
| ESLint `no-redeclare` | `const WorldId` e `type WorldId` são namespaces diferentes em TypeScript e padrão dos schemas Effect; a regra JavaScript acusa duplicação | Desativada em TS; o compilador TS7 e o type-check do Oxlint continuam rejeitando redeclarações inválidas |
| Unicorn `throw-new-error` | Acusa a fábrica oficial `extends Schema.TaggedError<T>()` e o autofix adiciona `new`, produzindo TS7009 | Desativada em TS; TS7 e as regras Effect de classes/erros continuam ativos |
| `promise-function-async` | Exige async no callback nativo de `Effect.tryPromise(signal => sdk.send(...))`, contrariando o Effect e gerando require-await | Callback de expressão/seta não precisa de async; declarações e métodos continuam verificados, assim como floating promises/effects |
| `max-classes-per-file` | Um conjunto fechado de schemas TaggedError não é um conjunto de serviços distintos | Até 16 classes nos módulos de contrato/schema; limite original preservado nas implementações |
| Regras Vitest | Um teste Playwright usa outro runner e importações próprias | Preset Vitest só em `*.test.*`; `*.spec.ts` pertence ao Playwright |
| Effect `async-function` | Playwright fornece APIs Promise e callbacks async nativos | Somente os testes `*.spec.ts` usam essa borda imperativa; regras de produto permanecem ativas |

As APIs foram conferidas em `node_modules/effect/AGENTS.md`, exemplos de Effect.tryPromise/Schema.TaggedError e fontes instaladas. A semântica da configuração de regras foi conferida no schema do Oxlint instalado. Essas escolhas são compatibilidade de ferramentas, não prova de autorização ou integração de produto.

## Serviços de teste

`ops/compose.yaml` usa PostgreSQL 18.6 e RustFS com digests reais verificados no registro, incluindo manifests amd64/arm64. Publica somente em loopback. `.env.infra` é local, ignorado pelo Git, com credenciais geradas para esses serviços efêmeros. CI gera novas credenciais para cada execução.

O usuário `zoen_infra` instala namespaces de teste; `zoen_runtime` não possui DDL, superuser, criação de roles ou de bancos. Os probes concedem direitos mínimos somente em seu namespace UUID e o removem ao terminar. Isso é infraestrutura de prova; não cria uma identidade privilegiada na aplicação.

Subir: `docker compose --env-file .env.infra -f ops/compose.yaml up -d --wait`. Integrações: `pnpm test:integration`. Não remover volumes locais para corrigir uma falha. O teardown com volumes da CI atua somente na execução efêmera daquele runner.

Testes unitários usam `*.test.ts(x)`; integrações usam `*.integration.test.ts(x)`; navegador usa `*.spec.ts`. Seleção vazia é erro. `pnpm test:components` verifica a fixture explícita da interface; não conta como jornada do produto conectado. A jornada real será acrescentada com a composição HTTP/identidade correspondente.

## Build dos módulos

`pnpm build:core` compila os módulos reais de contracts e authority com TS7 e referências de projeto. Cada workspace publica seus próprios arquivos `dist/*.js` e declarações; o Node carrega o HttpApi e o executor compilados sem loader de teste. Imports relativos `.js` das fontes são resolvidos pelo compilador, e imports `.ts` são reescritos no artefato.

A análise global continua cobrindo fontes e testes pelo tsconfig raiz. Vitest usa aliases explícitos para as fontes e herança do config nos dois projetos; as provas de unidade e integração não dependem de um `dist` antigo. A CI compila o core e carrega os módulos emitidos separadamente. Esse build não conclui o servidor, o cliente web ou a CLI, cujos entrypoints ainda estão em composição.

Uma contraprova em worktree sem `dist` mostrou que targets de `paths` sem a extensão `.ts` não resolviam com NodeNext. Os targets incluem a extensão explicitamente. O typecheck foi repetido com os dois diretórios `dist` retirados temporariamente da árvore e passou; os artefatos foram preservados e restaurados depois da execução.

## Declarações de Better Auth

Um import real de `better-auth@1.7.2` reproduziu quatro erros de declaração no TS7 estrito: os tipos opcionais `bun:sqlite` e Cloudflare ausentes, um default genérico emitido por `@better-fetch/fetch@1.3.1` incompatível com `exactOptionalPropertyTypes`, e um `Timer` global inexistente no Node. `skipLibCheck` permanece falso.

Os pacotes oficiais `bun-types@1.4.1` e `@cloudflare/workers-types@5.20260905.1` fornecem os tipos exigidos pelo contrato da biblioteca. O tsconfig inclui somente `bun-types/sqlite`: carregar todos os tipos Bun reproduziu conflitos de `ImportMeta` com Vite e de globals com Node 24. Essa seleção usa a declaração original do fornecedor e não instala um runtime Bun ou um adapter SQLite na aplicação.

O patch versionado em `patches/@better-fetch__fetch@1.3.1.patch`, aplicado pelo pnpm e vinculado no lock, altera somente as duas declarações ESM/CJS. Ele restaura o alias genérico de [fetch.ts no upstream](https://github.com/better-auth/better-fetch/blob/2d16606a5f8145e4e1540896e6e7121d5a23a9b0/packages/better-fetch/src/fetch.ts) e o tipo `ReturnType<typeof setTimeout>` de [utils.ts na mesma revisão](https://github.com/better-auth/better-fetch/blob/2d16606a5f8145e4e1540896e6e7121d5a23a9b0/packages/better-fetch/src/utils.ts). Nenhum JavaScript da dependência foi alterado. O mesmo import passou no typecheck completo após essas correções; a prova de identidade usa os fluxos reais de EX09.

## Declaração interna da CLI Effect

Importar `Command` de `effect/unstable/cli` reproduziu TS2339 em `internal/command.d.ts`: `ReturnType<typeof Param.getParamMetadata>` referencia uma função marcada `@internal`, removida da declaração pública de Param. A função existe tanto na [fonte da versão rc.112](https://github.com/Effect-TS/effect/blob/effect%404.0.0-rc.112/packages/effect/src/unstable/cli/Param.ts) como no JavaScript publicado.

O patch pnpm `patches/effect@4.0.0-rc.112.patch` substitui apenas essa referência inválida pelo tipo estrutural exato declarado pela função: dois booleanos e dois `Option<number>`. Não expõe função interna como API, não altera runtime e não desativa checagem de declarações. A contraprova independente numa cópia isolada da dependência e o mesmo import no typecheck completo passaram com o patch; a versão original falhou com TS2339.

## Integrações e fronteira POSIX

`vitest/max-expects` não se aplica a `*.integration.test.*`: o ciclo real de captura, pin, remoção e abertura exige verificar vários estados do mesmo recurso, e o maior teste atual possui 16 asserções. A regra de contagem não substitui revisão da testemunha. Os testes continuam executados, sem supressão inline ou alteração de resultados esperados.

Somente a categoria de adapters folha `**/adapters/posix.ts` permite imports Node de arquivos e operações bitwise nativas. `FileSystem.open` da versão instalada aceita flags textuais, sem `O_NOFOLLOW`; o adapter Node de `FileSystem.stat` segue links e não oferece `lstat`. O adapter POSIX usa esses recursos concretos para proteger arquivos de credenciais, envolvidos em Effects com aquisição/liberação. A aplicação usa FileSystem/Path/streams Effect, e o adapter continua sujeito a todos os outros checks e às fronteiras de imports.

O adapter de listener `**/adapters/http.ts` usa `node:http.createServer`, a fábrica que a API instalada `NodeHttpServer.layer` exige. A sugestão de usar HttpClient não substitui a criação de um servidor. Somente essa sugestão de import fica desativada nessa categoria.

`pnpm build:apps` compila servidor e CLI nos respectivos workspaces, preservando resolução real de dependências pelo Node. Depois gera `apps/server/dist/release.json` a partir dos hashes dos JavaScripts emitidos e do lock atual. É um manifesto do build local, não um certificado de admissão. A configuração de instalação persiste IDs reais de cell/generation e o digest desse manifesto; o servidor recusa uma instalação que aponte para outro build.
