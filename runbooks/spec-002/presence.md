# Runbook — Better Auth presence-only port (ZN-0013)

**Status:** implementation-in-progress; not accepted. Component-layer.

## Scope

`createDoor` + `createDoorPort`: Better Auth session → `PresenceProof` with `worldGrant: null`. Subject map uses opaque user id, never email/name. Revoked sessions fail closed.

## Observe

1. Authenticated subject without membership → `attemptPrivateWorldEntry` = `Denied/PRESENCE_NOT_A_GRANT`.
2. After `revokeSession`, `verify` returns `AUTHENTICATION_REQUIRED`.
3. Wrong audience → `WRONG_AUDIENCE`.

## Repair

```sh
export ZOEN_TEST_DATABASE_URL='postgresql://zoen_test:zoen_test_disposable@127.0.0.1:55432/zoen_harness'
node --experimental-strip-types --test tests/component/spec-002/presence.test.ts
```

Do not fabricate lock digests. Ticket remains unaccepted.
