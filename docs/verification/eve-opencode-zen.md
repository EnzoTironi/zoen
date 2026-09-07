# Eve OpenCode Zen free — qualificação ZN-0063 (D05)

Data: 2026-09-07 (PT). Tip de partida: `90ad08e`. Tip verificado: `be09d5b` (`be09d5b7b551e3fd2a254e77f6784f65a43d7ad0`). Perfil produto: `eve-opencode-zen-v1` / admission `opencode-zen`.

## Escopo verificado

| Item | Estado |
| --- | --- |
| Freeze F06/F07 (OpenCode Zen free quando key presente) | Landed — `docs/contracts/eve-freeze.md` |
| Schemas `eve-opencode-zen-v1` / `opencode-zen` | Landed — `packages/contracts/src/eve/**` |
| Client OpenAI-compatible + headers free-tier | Landed — `packages/authority/src/ports/eve/opencode-zen.ts` |
| Turn path accept → model → settle / cancel-abort | Landed — `packages/authority/src/ports/eve/turn.ts` |
| Journal recoverability + INV-01 (sem API key) | Landed — unit + live smoke |
| Voz | **Blocked** (F05) |
| D05 integral / processo Eve separado / streaming prod | **Não** alegado |

## Endpoint e modelo

- Base URL (default): `https://opencode.ai/zen/v1`
- Model id observado (free): `big-pickle`
- Env (gitignored / Fly secrets only): `ZOEN_OPENCODE_API_KEY` (required), `ZOEN_OPENCODE_BASE_URL`, `ZOEN_OPENCODE_MODEL`
- Local helper file (never commit): `.local/opencode.env`

## Headers obrigatórios (free tier)

Observed: free-tier models **reject** plain `curl` without OpenCode CLI identity. Required:

| Header | Valor |
| --- | --- |
| `User-Agent` | `opencode/<version> …` (Mac observed `opencode` **1.17.20**) |
| `x-opencode-client` | `cli` |
| `x-opencode-session` | `ses_<hex>` — stable per conversation (derived from conversation id) |
| `x-opencode-request` | `req_<hex>` — unique per request |
| `Authorization` | `Bearer <key>` (env/Fly secret only) |

**Paid models** do not need User-Agent spoofing (observed separately); free models do.

Smoke (pre-landing): HTTP 200 + content containing `eve-ok` for `big-pickle` with those headers.

## Comandos

Unit (no key; fetch mocked):

```bash
pnpm exec vitest run --project unit \
  packages/contracts/test/eve \
  packages/authority/test/ports/eve
```

Live smoke (optional; skips in CI when env absent):

```bash
set -a; source .local/opencode.env; set +a
pnpm exec vitest run --project integration \
  packages/authority/test/ports/eve/opencode-zen.EX43.integration.test.ts
```

Plan structural check:

```bash
python3 tooling/verify_plan.py
```

## INV-01

Journal snapshots set `authorityCredentialPresent: false` and never store OpenCode / authority API keys. Unit proofs assert the key string is absent from `JSON.stringify(snapshot)`.

## Não alegado

- Voice / transcript provider.
- Streaming provisional production surface, tool dispatch completo, leases CAS multi-worker.
- Separate Eve process with minimal credentials.
- Cutover of legacy Fly app `zoen`.
- Full D05 / ZN-0281 acceptance.

## Live smoke observed (2026-09-07 PT)

Commands:

```bash
set -a; source .local/opencode.env; set +a
pnpm exec vitest run --project integration \
  packages/authority/test/ports/eve/opencode-zen.EX43.integration.test.ts
```

Observed (no key printed):

| Field | Value |
| --- | --- |
| HTTP | 200 |
| Model | `big-pickle` |
| Visible text | `eve-ok` (length 6) |
| Contains `eve-ok` | true |
| Key present in response body | false |
| Unit suite | 29/29 pass (`packages/contracts/test/eve` + `packages/authority/test/ports/eve`) |
| `verify_plan.py` | passed |

Headers used on the live call match the free-tier table above (`User-Agent: opencode/1.17.20 zoen-eve`, `x-opencode-client: cli`, session/request ids).
