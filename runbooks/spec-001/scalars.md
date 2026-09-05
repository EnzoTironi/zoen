# Runbook — decimal, money and unit algebra (ZN-0008)

**Status:** implementation-in-progress; not accepted. Law-layer only.

## Scope

Exact decimal arithmetic (precision 38 / scale ≤ 18), money with currency equality, and quantity comparison only with equal units or an explicit released conversion factor.

## Observe

1. Capture amount strings, currencies/units and any conversion evidence IDs.
2. Prefer Result parsers (`normalizeDecimal`, `parseMoney`, `compareMoney`, `compareQuantities`).
3. Mixed currencies or missing conversion yield `NonComparable` / `InvalidInput` — never locale or float coercion.

## Repair

1. Do not invent conversion factors; require released evidence + effective date.
2. Overflow and required rounding are explicit errors, not truncation.
3. Re-run:

```sh
pnpm exec tsc --ignoreConfig --target ES2022 --module NodeNext --moduleResolution NodeNext --lib ES2023,DOM --strict --declaration --outDir .core-build --rootDir . packages/kernel/src/decimal.ts packages/kernel/src/result.ts
node --experimental-strip-types --test tests/law/spec-001/scalars.test.ts
```

## Resume

Independent review required before acceptance. Do not mark ZN-0008 accepted from this runbook.
