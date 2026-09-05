# Runbook — evidence-bound pull-request completion (ZN-0005)

**Status:** implementation-in-progress; not product-accepted.

## Scope

`VerifyTicket` reads catalog check ownership, rejects missing/skipped/zero executions, ignores green generic builds as substitutes, emits commit-bound evidence, and requires independent review for critical tickets.

## Commands

```sh
source .toolchain-env.sh
# Fail closed without observed evidence:
pnpm verify:ticket --ticket ZN-0005 --profile admitted-static-profile

# With observed evidence JSON:
node --experimental-strip-types tooling/verify-ticket.ts \
  --ticket ZN-0003 --profile admitted-static-profile \
  --evidence path/to/observed.json --out evidence/out.json
```

## Repair

| Symptom | Repair |
|---|---|
| missing check ID | Run the owning test file; do not weaken fixtures |
| skipped required check | Remove skip; execute at required layer |
| independent reviewer required | Obtain distinct human reviewer approval bound to commit+lock |
| green generic build | Cannot replace ticket checks |

Disabled route: `ticket-acceptance-and-merge`. Do not self-accept.
