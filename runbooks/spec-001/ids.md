# Runbook — branded IDs and realm-safe boundary parsers (ZN-0007)

**Status:** implementation-in-progress; not product-accepted. Law-layer only.

## Scope

Opaque UUID / Digest / Revision / SemanticId / Counter branding, `WorldRef` with live|evaluation realm, and live-only Action boundary parsing under SPEC-001.

## Preconditions

- Exact ticket ZN-0007; stacked on ZN-0006 (unaccepted).
- Toolchain: Node 24 + pnpm 11.25 from `.toolchain-env.sh`.
- No repository / provider I/O in this boundary.

## Observe

1. Capture the untrusted payload and declared realm.
2. Run the pure parsers (`parseWorldRef`, `parseLiveOnlyActionInput`, …).
3. Record tagged `InvalidInput` codes (`LIVE_REALM_REQUIRED`, `CROSS_WORLD_OR_REALM`, `INVALID_*`) without branding partial values.

## Repair

1. Do not coerce realm, UUID case beyond lowercase normalization, or counter overflow.
2. Reject evaluation `WorldRef` on live-only Action inputs before any repository call.
3. Preserve fixture seed `zn-0007-ids-seed-v1` and failing counterexamples.
4. Re-run law checks (the test file emits the kernel subset to `.core-build` first):

```sh
source .toolchain-env.sh
node --experimental-strip-types --test tests/law/spec-001/ids.test.ts
```

## Resume

Resume only after AC / NEG / BOUNDARY pass and independent review. Do not mark the ticket accepted from this runbook.
