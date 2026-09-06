# EX26 — contraprovas independentes (worker-3)

Ângulos distintos da suíte de autoria EX25 em `../basis/`. Harness legado reutilizado; oráculos não são reexecução mecânica de BC-01..09.

## O que estas provas exercitam

| Arquivo | Ângulo |
| --- | --- |
| `legacy-bases.review.integration.test.ts` | Dois Worlds reais pré-007; versões/frames/receipts byte-iguais após transição; migrator idempotente; digest legado corrompido → `Unavailable`; digest v2 errado → `Stale` |
| `audience.review.integration.test.ts` | Grant **antes** da transição; viewer congela Frame público; emissão sem `authority.basis.v2`/grafo; stranger/viewer-propose negados; revoke bloqueia emissão |
| `concurrency.review.integration.test.ts` | Corrida real Answer×bump de `identity` sob locks; corrida Answer×ImportEvidence (writer de claims); sem apply parcial |
| `migration-sigkill.review.integration.test.ts` | SIGKILL com transação 007 aberta (não `Effect.fail` injetado); snapshot inalterado; CHECK parcial → `Unavailable`; recovery pelo migrator |
| `split-writers.review.integration.test.ts` | EX27 adversarial: membro estrangeiro → InvalidPartition; stranger → NotFoundOrDenied; opId replay vs Conflict; recovery-split sem separação bloqueado sem nova decision |
| `writers-sigkill.review.integration.test.ts` | ID-08: SIGKILL real em `ResolveIdentity` com outbox lock; rollback sem decision/receipt/outbox; replay pós-commit |
| `writers-concurrency.review.integration.test.ts` | ID-08: ResolveIdentity × bump de `identity` e × ImportEvidence; Stale sem decision parcial |

## Lacunas honestas (EX26 acceptance)

1. **Grafo / ausência / recuperação após novas claims:** writers EX27 ainda não existem. Não há oráculo de aresta redundante, phantom/ausência ou recovery estrutural em integração real.

Update 2026-09-06: EX27 vertical slice writers exist (`handlers.EX27`); core proves Resolve Stale after identity bump and recovery undo. Full redundant-edge/phantom oracles still open under independent/.

Update 2026-09-06 (EX27 split): `ProposeIdentitySplit` is real; independent `split-writers.review.integration.test.ts` adversarially exercises InvalidPartition/smuggled member, stranger denial, opId intent Conflict, and recovery-split blocked without identity writes. 2. **Limites de bytes/entries da Question de recuperação:** dependem dos handlers EX27 e da garantia prospectiva do contrato. 3. **Web/CLI de identidade (EX28):** fora de escopo; audiência aqui é executor+fence D01/sharing. 4. **Fence concorrente SH07/08 pós-identity:** não reexecutado; herda EX23. 5. **EX26 `acceptance_requires: EX27`:** pacote não pode ser `verified_for_profile` completo até EX27.

## Comandos

```bash
ZOEN_TEST_LEGACY_ROOT=/Users/enzotironi/zoen-rebuild/.local/identity-baseline-20260905-2203/source \
  node --env-file=.env.infra node_modules/vitest/vitest.mjs run --project integration \
  tests/integration/subject-identity/independent/
```

Update 2026-09-06 (ID-08 writers): independent SIGKILL + concurrency counterproofs for ResolveIdentity landed. Recovery Question byte/entry limits remain open.
