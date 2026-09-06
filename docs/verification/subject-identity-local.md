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
| Qualidade estática | `pnpm format:check` passou. `pnpm lint` / `pnpm typecheck` **ainda falham** em suítes EX25–EX27 pré-existentes no tip (~53 erros TS); bloqueia CI quality. |
| Unidade | 241 testes / 35 arquivos passaram (antes da correção de Stale; leis/pure inalteradas). |
| Integração identidade | core/basis/independent + CLI journey + requests EX28: 12 arquivos / 13 testes passaram com PG/S3/Better Auth reais. |
| Aceitação ID-15 | Chromium passou no profile `subject-identity-v2`: inspect → propose same-as → confirm. |
| Regressão sharing | O cenário independente EX23 Stale+grant voltou a passar após o scoping de Stale (falhava com dois `role=alert`). |
| Imagem | `zoen-local:container-bfd0485f1d994118`: **13/13** aceitações passaram (~3 min), incluindo ID-15 e EX23 Stale independente. Um run anterior falhou por alerta cruzado de Stale (corrigido). CI remota: ver checkpoint. |

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

## Lacunas antes de `verified_for_profile`

- Qualidade: typecheck/lint das suítes identity herdadas.
- EX27: ID-08 concurrency/SIGKILL completo; limites de recovery; review worker-3.
- EX28: browser de negação de viewer; polish de undo.
- EX29: aceitação completa na imagem + CI remota verdes; não alegar D02/erasure/cloud.

Próximo passo sugerido: fechar dívida de qualidade typecheck **ou** iniciar incremento de **apagamento/erasure (D03)** mantendo EX29 como partial até CI verde.
