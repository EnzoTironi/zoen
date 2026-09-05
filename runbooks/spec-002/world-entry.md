# Runbook — purpose-bound grants and request permits (ZN-0015)

**Status:** implementation-in-progress; not accepted. Component-layer.

## Scope

`openWorld` resolves membership/security revision and mints an opaque grant stored by hash.
`issueRequestPermit` binds grant + semantic operation + body digest + audience + cell epoch.
`authorizeRequestPermit` revalidates before disclosure; Focus never embeds grant/permit secrets.

## Observe

1. Grant for `billing.read` reused for `clinical.note.read` → `Denied`.
2. Altered body, realm, audience or expired permit → deny/expire without domain writes.
3. Wrong principal / revoked membership / emergency deny → no grant minted.

## Open gates

- Inherited: ZN-0024 (process-kill chaos) remains open on the ZN-0014 dependency; not claimed closed here.
- Ticket remains unaccepted pending independent review and evidence binding.

## Repair

```sh
export ZOEN_TEST_DATABASE_URL='postgresql://zoen_test:zoen_test_disposable@127.0.0.1:55432/zoen_harness'
node --experimental-strip-types --test tests/component/spec-002/world-entry.test.ts
```
