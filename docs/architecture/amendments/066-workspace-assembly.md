# 066 — Uma árvore de execução, sem falsas implementações

**Decisão:** consolidar docs vigentes e materializar os caminhos explícitos de v4 com pseudocódigo tipado por papel. Preservar código/testes/SQL candidato e IDs de 325 tickets. Nenhuma feature adicional é declarada implementada.

## Ajustes de caminho

Os tickets passam a reutilizar os módulos candidatos abaixo; alterações estão no catálogo ativo e não no histórico preservado.

| Caminho anterior no plano | Caminho reutilizado |
|---|---|
| `packages/kernel/src/scalars.ts` | `packages/kernel/src/decimal.ts` |
| `packages/kernel/src/temporal.ts` | `packages/kernel/src/time.ts` |
| `packages/kernel/src/canonical.ts` | `packages/kernel/src/json.ts` |
| `packages/kernel/src/outcomes.ts` | `packages/kernel/src/result.ts` |
| `packages/door/src/presence.ts` | `packages/door/src/door.ts` |
| `packages/ontology/src/authority/commit.ts` | `packages/ontology/src/authority/transaction.ts` |

Esses ajustes evitam duas implementações de valores, tempo, parsing, resultados, Door e autoridade. Comportamentos faltantes continuam exigidos pelos mesmos tickets e checks.

## Contexto

Versões anteriores, handoffs obsoletos e logs antigos ficam comprimidos em archives e no Git. Specs atuais continuam disponíveis diretamente; as referências históricas têm um localizador explícito. Não extrair todos os históricos no prompt de implementação.

## Sem mocks

As permissões antigas para protocol peers nos tickets de harness/conectores são estreitadas: nesta execução, os testes de serviço usam componentes reais com dados sintéticos autorizados. Falta de serviço não tem substituto. Leis puras e controles de arquivos podem ser testados sem provedores porque não fingem esses provedores.

## Sem falsa conclusão

Pseudocódigo não altera `accepted`, admissões, contagens de testes ou qualificações. Configuração e evidência que dependem de execução ficam em sidecars. A seleção de código compilável é explícita; comentários não aumentam artificialmente a implementação validada.
