# Runbook — stable errors, state axes and exhaustive serializers (ZN-0011)

**Status:** implementation-in-progress; not accepted. Law-layer only.

## Scope

Public result/error tags, independent interpretation axes (`status` × `verification` × `contested`), distinct presence kinds (`Missing`/`Zero`/`False`/`Deleted`/`Present`), and JSON↔TypeScript serializers that reject unknown discriminants.

## Observe

1. Selected + contested + unverified + literal zero survives `encodeOutcomeResult` / `decodeOutcomeResult` unchanged.
2. Zero never becomes `Missing` or interpretation `unknown`.
3. Unknown result/presence/status discriminants return tagged `InvalidInput` (no coercion).

## Repair

```sh
node --experimental-strip-types --test tests/law/spec-001/outcomes.test.ts
```

Do not mark the ticket accepted. Independent review still required.
