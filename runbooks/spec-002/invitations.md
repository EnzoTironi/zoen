# Runbook — single-use invitation acceptance (ZN-0016)

**Status:** implementation-in-progress; not accepted. Component-layer.

## Scope

`createInvitation` hashes an opaque invitation secret bound to intended principal/role/expiry.
`acceptInvitation` consumes once and inserts membership + receipt atomically; World head (`release_digest`/`generation_id`) and claims stay unchanged.

## Observe

1. Intended principal wins a race against a stranger; stranger Denied.
2. Concurrent same `(invitation, principal, operationId)` → one membership; retries `replay: true`.
3. Accept never mutates `release_digest`, `generation_id`, or existing claims.

## Open gates

- Inherited: ZN-0024 chaos gate on the stack remains open; not claimed closed.
- Ticket unaccepted pending independent review.

## Repair

```sh
export ZOEN_TEST_DATABASE_URL='postgresql://zoen_test:zoen_test_disposable@127.0.0.1:55432/zoen_harness'
node --experimental-strip-types --test tests/component/spec-002/invitations.test.ts
```
