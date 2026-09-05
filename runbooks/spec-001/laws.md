# Runbook — algebraic and resource-limit laws (ZN-0012)

**Status:** implementation-in-progress; not accepted. Law-layer only.

## Scope

Seeded algebraic laws over decimal/interval/canonical digest plus bounded JSON parser rejection. ≥10_000 cases per named law; locale/TZ labels must not change results.

## Observe

1. `runLawSuite` returns `failed === 0` for seed `zn-0012-laws-seed-v1`.
2. Two locale/TZ runs agree via `lawSuiteDigestsAgree`.
3. Oversized / deep payloads return `InvalidInput` (no truncation).

## Repair

```sh
node --experimental-strip-types --test tests/law/spec-001/laws.test.ts
```

Preserve counterexamples from the report; do not mutate generators to hide failures. Ticket remains unaccepted.
