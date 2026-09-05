# Runbook — idempotent private World genesis (ZN-0014)

**Status:** implementation-in-progress; not accepted. Component-layer.

## Scope

`createPersonalWorld` commits World + owner membership + receipt + outbox in one SERIALIZABLE transaction keyed by `ontology.bootstrap_operations`.

## Observe

1. Concurrent same `(principal, operationId, intent)` → exactly one World/receipt; retries `replay: true`.
2. Same operationId with different seedDigest → `Conflict/OPERATION_ID_REUSED`.
3. Invalid seedDigest → `InvalidInput`.

## Open gates

- ZN-0024 (process-kill chaos at commit boundaries) remains an unaccepted dependency for full ticket acceptance.

## Repair

```sh
export ZOEN_TEST_DATABASE_URL='postgresql://zoen_test:zoen_test_disposable@127.0.0.1:55432/zoen_harness'
node --experimental-strip-types --test tests/component/spec-002/genesis.test.ts
```
