# Runbook — session termination and emergency deny (ZN-0017)

**Status:** implementation-in-progress; not accepted. Component-layer.

## Scope

`revokePrincipal` / `setEmergencyDeny` advance `security_revision` and write audit.
`finalizeDisclosure` rechecks membership/emergency/security before sending a Frame payload.
Suppression is audited; already-delivered content is not claimed recalled.

## Observe

1. Frame composed then principal revoked → finalize returns disclosure-safe denial + audit `DisclosureSuppressed`.
2. Emergency deny blocks fresh compose/disclosure.
3. Concurrent deny + finalize: at least one suppression; no broad payload leak after deny commits.

## Open gates

- Inherited ZN-0024 chaos gate remains open; ticket unaccepted.

## Repair

```sh
export ZOEN_TEST_DATABASE_URL='postgresql://zoen_test:zoen_test_disposable@127.0.0.1:55432/zoen_harness'
node --experimental-strip-types --test tests/component/spec-002/revocation.test.ts
```
