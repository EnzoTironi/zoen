# Runbook — genesis and entry isolation on real roles (ZN-0018)

**Status:** implementation-in-progress; not accepted. Component-layer.

## Scope

Migration `zn-0018_entry-isolation.sql` provisions `zoen_authority`, `zoen_door`, `zoen_eve`, `zoen_channel`, `zoen_outbox` (NOLOGIN, no superuser).
`probeRoleIsolation` uses `SET ROLE` to prove forbidden DDL/membership/cross-World paths fail while authority entry still works.

## Observe

1. Door/Eve/channel cannot DDL ontology or write memberships.
2. Cross-World reads under wrong `zoen.world_id` return empty under RLS.
3. Runtime roles are not superuser / not BYPASSRLS.

## Open gates

- Inherited ZN-0024 chaos gate remains open; ticket unaccepted.

## Repair

```sh
export ZOEN_TEST_DATABASE_URL='postgresql://zoen_test:zoen_test_disposable@127.0.0.1:55432/zoen_harness'
node --experimental-strip-types --test tests/component/spec-002/entry-isolation.test.ts
```
