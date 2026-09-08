# Eve HTTP/CLI surface — EX44 (OpenCode Zen product path)

Data: 2026-09-07 (PT). Tip verificado: `c689f2a` (`c689f2acddace0ccb532a22964960647d1ac11ea`). Perfil produto: `eve-opencode-zen-v1` / admission `opencode-zen`. Path: `/api/eve/execute`.

## Escopo verificado

| Item | Estado |
| --- | --- |
| HTTP group `/api/eve/execute` (turn / cancel / recover) | Landed |
| CLI `eve-turn` / `eve-cancel` / `eve-recover` | Landed |
| Web request assembly (`features/eve/requests.ts`) | Landed |
| Product default = OpenCode Zen (no stub) | Landed — stub-local Blocked on surface |
| Fail-closed when `ZOEN_OPENCODE_API_KEY` absent | Landed — `Blocked` / `PROFILE_BLOCKED` |
| INV-01 journal never stores API keys | Landed — unit asserts |
| Voice | **Blocked** |
| D05 integral / streaming / separate Eve process | **Não** alegado |
| Cutover legacy `zoen` | **Não** |

## Fluxo

`AcceptConversationTurn` (autenticado, `worldRef` owner/mutate) → `runEveTurn` accept → OpenCode Zen free → settle → `ConversationMessageSettled` (inclui `visibleText`).

`CancelConversationTurn` cancela antes de settle. `RecoverConversationJournal` devolve snapshot sem modelo. `SettleConversationMessage` via HTTP é `Unsupported` (settle só server-owned).

## Headers free-tier (client OpenCode)

Mesmos headers EX42/EX43: `User-Agent: opencode/1.17.20 zoen-eve`, `x-opencode-client: cli`, `x-opencode-session`, `x-opencode-request`, `Authorization: Bearer <ZOEN_OPENCODE_*>` (env/Fly only).

## Comandos

```bash
pnpm exec vitest run --project unit \
  packages/contracts/test/eve \
  packages/ontology/test/ports/eve \
  apps/web/test/integration/eve

pnpm exec vitest run --project integration \
  apps/server/test/composition/eve/http.EX44.integration.test.ts

# Live (optional; skips/Blocked without key):
set -a; source .local/opencode.env; set +a
pnpm exec vitest run --project integration \
  packages/ontology/test/ports/eve/opencode-zen.EX43.integration.test.ts
```

## Não alegado

- Voice / transcript.
- Durable PG journal (in-memory journal for this increment).
- Full web chat panel wired into workspace controller.
- Legacy Fly `zoen` cutover.
