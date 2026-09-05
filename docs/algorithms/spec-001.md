# SPEC-001 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-001](../specs/spec-001.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Kernel**. Module: `packages/kernel/src`. Milestone: **S0**.

## Normative operation signatures

```text
parseEnvelope(bytes) -> ValidEnvelope | InvalidInput; normalizeDecimal(text, scalePolicy) -> Decimal | InvalidScalar; compareIntervals(a,b) -> ComparableInterval | NonComparable; canonicalDigest(value) -> sha256.
```

## State and transaction contract

No tables. Normative JSON schemas live under contracts/kernel. IDs are opaque UUID values tagged at runtime with world/realm; counters and monetary values cross JSON as decimal strings. Database identifiers must not be guessable credentials.

## Shared algorithm

```text
INPUT: untrusted bytes or scalar plus explicit schema, precision, unit and temporal policy.
CHECK byte/depth/entry limits before recursive parsing; reject duplicate keys, invalid Unicode and remote schema references.
PARSE IDs before branding; bind World and realm, never treat an opaque ID as authorization.
NORMALIZE decimals with exact arithmetic, explicit rounding and checked scale/overflow; zero and missing remain different.
COMPARE units only with equal dimensions/currency or a released evidenced conversion; never guess locale.
PARSE Instant, LocalDate and wall time as different types; require an explicit choice for ambiguous wall time.
CANONICALIZE admitted values deterministically and hash actual canonical bytes; no network or environment access.
RETURN tagged errors without partial branding; preserve counterexamples for generated-law tests.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0007](../tickets/zn-0007.md) | Define branded IDs and realm-safe boundary parsers | [packages/kernel/src/ids.ts](../../packages/kernel/src/ids.ts.plan.md) |
| [ZN-0008](../tickets/zn-0008.md) | Implement decimal, money and unit algebra | [packages/kernel/src/decimal.ts](../../packages/kernel/src/decimal.ts.plan.md) |
| [ZN-0009](../tickets/zn-0009.md) | Implement time kinds and half-open intervals | [packages/kernel/src/time.ts](../../packages/kernel/src/time.ts.plan.md) |
| [ZN-0010](../tickets/zn-0010.md) | Implement bounded canonical parsing and hashing | [packages/kernel/src/json.ts](../../packages/kernel/src/json.ts.plan.md) |
| [ZN-0011](../tickets/zn-0011.md) | Define stable errors, state axes and exhaustive serializers | [packages/kernel/src/result.ts](../../packages/kernel/src/result.ts.plan.md) |
| [ZN-0012](../tickets/zn-0012.md) | Prove algebraic and resource-limit laws | [packages/kernel/src/laws.ts](../../packages/kernel/src/laws.ts) |

## Required proof boundaries

Validate before branding. Reject duplicate JSON keys and unsupported versions. Authority JSON permits finite I-JSON numbers only for bounded counters/flags; money uses strings. No locale guessing in canonical input. Date is not Instant. Currency/unit conversions require a released factor and evidence/effective interval. Normalize negative zero; preserve declared precision and never use Number for money.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
