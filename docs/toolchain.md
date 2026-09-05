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
