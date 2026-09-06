# Identidade de assuntos — prova local (EX29)

Em 2026-09-06 (PT), o incremento EX24–EX28 está composto no mesmo `SemanticExecutor` e `DisclosureFence` usados por HTTP, Web e CLI. O perfil de política permanece `d01-local-retained-v1`: dados admitidos não sensíveis, sem apagamento ou restore. **Isto não conclui D02 integral** e **não** marca EX29 como `verified_for_profile`.

O build integrado em `codex/rebuild` foi provisionado no profile **`subject-identity-v2`** (`http://127.0.0.1:4319`) após correção de Stale cruzado no cliente. O manifesto `apps/server/dist/release.json` observado tem SHA-256 `89c538fc35c4aeca65b11332a8678caec010d5ff50e607870f7a4f31094e41e4`. O profile anterior `subject-identity-v1` (`:4318`) e demais profiles (`application`, `csvv2`, sharing, baselines EX14, identity-baseline) foram **preservados**; nenhum World antigo recebeu outro release digest.

## Dívida de caminho HTTP

Rotas/arquivos novos preferem `subject-identity`. O endpoint HTTP composto permanece `POST /api/d02/subject-identity`. Renomeação em massa de caminhos `d01`/`d02` existentes ficou **adiada** por Enzo; trate `/api/d02/` como dívida conhecida.

## Correção de composição (cliente)

`apps/web/src/features/d01/state.ts` deixou de marcar `identity.stale` e `sharing.stale` juntos em qualquer `Stale`. Cada família (subject-identity vs sharing) só acende o alerta correspondente. Sem isso, o painel de identidade poluía `getByRole('alert')` das provas independentes EX23.

## Resultado observado por camada

| Camada | Evidência |
| --- | --- |
| Composição | `composition.ts` liga `makeSubjectIdentityHttpGroup` ao mesmo executor/fence. Web + CLI consomem os mesmos schemas. |
| Qualidade estática | `pnpm format:check` / lint / typecheck cleared on tip `5da8582`+; main CI format/lint/typecheck/build green on later tips. |
| Unidade | 241+ testes identity-related na suíte unit. |
| Integração identidade | core/basis/independent + CLI journey + requests EX28; independent agora inclui SIGKILL de `ResolveIdentity` e concorrência Resolve×bump/Import. |
| Aceitação ID-15 | Chromium no profile `subject-identity-v2`: inspect → propose same-as → confirm. |
| Aceitação EX28 viewer | Chromium: leitor com grant não vê região/controles de identidade; `InspectSubjectIdentity` via fetch devolve negação sem Frame privado. |
| Undo UX | Botão barato «Propor undo da última decisão» quando há `decisionRef` aplicado. |
| Regressão sharing | EX23 Stale+grant independente verde após scoping de Stale. |
| Imagem | `zoen-local:container-bfd0485f1d994118`: **13/13** aceitações (~3 min) no tip anterior; revalidar imagem/CI após este incremento. |

## Executar

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

## Lacunas antes de `verified_for_profile`

- Recovery Question limits (bytes/entries prospectivos) ainda não têm oráculo dedicado de quota.
- CI remota: `verify_plan` / integração (legacy baseline, SH-04/EX05 drift) podem ainda falhar no agregado; não alegar D02/erasure/cloud.
- Aceitação completa na imagem nova após este tip (re-run container + CI).

Próximo passo sugerido: fechar oráculo de limites de Question de recuperação **ou** iniciar incremento de **apagamento/erasure (D03)** mantendo EX29 partial até CI/imagem verdes no tip novo.
