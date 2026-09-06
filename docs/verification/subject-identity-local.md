# Identidade de assuntos — prova local (EX29)

Em 2026-09-06 (PT), o incremento **EX24–EX29** (`subject-identity-v2`) está composto no mesmo `SemanticExecutor` e `DisclosureFence` usados por HTTP, Web e CLI, e fica marcado **`verified_for_profile`** para o perfil local/container deste tip.

- Tip verificado: `cae72de` (`cae72de2be45c59ab63d1fbfc742a51ba34ae1b6`).
- CI Main Verify **verde** (inclui container): https://github.com/EnzoTironi/zoen/actions/runs/34062093334
- Política de dados dos Worlds continua `d01-local-retained-v1`: admitidos não sensíveis, **sem** apagamento ou restore. Erasure segue em D03 (freeze em `docs/contracts/d03-erasure-freeze.md`).

**Isto não conclui D02 integral.** Merge/split stewardship além da identidade temporal deste incremento, workbench/priorização, ACL por fonte, cloud e as demais entregas do mapa permanecem fora deste checkpoint.

O profile **`subject-identity-v2`** (`http://127.0.0.1:4319`) e a imagem de aceitação foram exercidos nas provas verticais; profiles anteriores (`subject-identity-v1`, `application`, `csvv2`, sharing, baselines) foram **preservados** — nenhum World antigo recebeu outro release digest.

## Dívida de caminho HTTP

Rotas/arquivos novos preferem `subject-identity`. O endpoint HTTP composto permanece `POST /api/d02/subject-identity`. Renomeação em massa de caminhos `d01`/`d02` existentes ficou **adiada** por Enzo; trate `/api/d02/` como dívida conhecida.

## Correção de composição (cliente)

`apps/web/src/features/d01/state.ts` deixou de marcar `identity.stale` e `sharing.stale` juntos em qualquer `Stale`. Cada família (subject-identity vs sharing) só acende o alerta correspondente.

## Evidência do checkpoint `verified_for_profile`

| Camada | Evidência |
| --- | --- |
| Composição | Mesmo executor/fence em HTTP/Web/CLI; `makeSubjectIdentityHttpGroup` no composition. |
| Qualidade | Format/lint/typecheck verdes no tip integrado; job de qualidade na CI do run acima. |
| Unidade | Suites identity + oráculo EX27 de limites de Question de recuperação (bytes/entries/depth). |
| Integração | core/basis/independent writers: SIGKILL de `ResolveIdentity`, concorrência Resolve×bump/Import, split. |
| Aceitação ID-15 | Chromium no profile `subject-identity-v2`: inspect → propose same-as → confirm. |
| Aceitação EX28 viewer | Chromium: viewer com grant não vê região/controles; Inspect via fetch devolve negação sem Frame privado. |
| Undo UX | Botão «Propor undo da última decisão» quando há `decisionRef` aplicado. |
| Regressão sharing | EX23 Stale+grant independente verde após scoping de Stale. |
| Container + CI | Main Verify `34062093334` success em `cae72de`, incluindo aceitação em imagem. |

## Executar (reprodução)

```bash
pnpm build
ZOEN_LOCAL_PROFILE=subject-identity-v2 \
  ZOEN_LOCAL_PUBLIC_URL=http://127.0.0.1:4319 \
  pnpm provision:local
ZOEN_LOCAL_PROFILE=subject-identity-v2 pnpm start:server
ZOEN_LOCAL_PROFILE=subject-identity-v2 \
  ZOEN_TEST_SUBJECT_IDENTITY_WEB_URL=http://127.0.0.1:4319 \
  ZOEN_TEST_WEB_URL=http://127.0.0.1:4319 \
  ZOEN_TEST_CSV_WEB_URL=http://127.0.0.1:4319 \
  ZOEN_TEST_SHARING_WEB_URL=http://127.0.0.1:4319 \
  pnpm test:acceptance -- apps/web/test/integration/subject-identity/identity.browser.spec.ts
```

Integração writers (PG/S3/Better Auth reais):

```bash
node --env-file=.env.infra node_modules/vitest/vitest.mjs run --project integration \
  tests/integration/subject-identity/independent/writers-sigkill.review.integration.test.ts \
  tests/integration/subject-identity/independent/writers-concurrency.review.integration.test.ts
```

Oráculo de limites da Question de recuperação (unidade):

```bash
pnpm exec vitest run --project unit \
  packages/authority/test/knowledge/subject-identity/recovery-question-limits.EX27.test.ts
```

## Fora deste checkpoint

- D02 merge/split stewardship breadth além da identidade deste incremento.
- Apagamento/erasure (D03.2) — freeze mínimo separado; purge real ainda bloqueado.
- Restore após erasure, cloud/Fly, upgrade de Worlds antigos.
