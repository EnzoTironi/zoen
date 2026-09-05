# File plan — `tests/fixtures/spec-001/temporal.json`

**Status:** implementation-in-progress; no product acceptance implied.

Target: `tests/fixtures/spec-001/temporal.json`. Representation: **existing-with-sidecar**. Allocation: **conditional-support**.

Specs: [SPEC-001](../../../docs/specs/spec-001.md).
Tickets: [ZN-0009](../../../docs/tickets/zn-0009.md).

## Responsibility and reuse

The adjacent implementation is preserved. Read it first, extend it in place, and prove behavior at the ticket's required layer. Do not replace it with this plan or create a duplicate primitive.

```text
CONDITIONAL INPUT FIXTURE PLAN — not an observed service result.
USE synthetic records within owned disposable namespaces and explicit valid/knowledge time.
INCLUDE comparable rivals, a denied source, duplicate provenance family and stale dependency when in scope.
COMPUTE fixed expected values from the owning oracle, not from the implementation under test.
LOAD through the real component/journey boundary; do not replace provider/database behavior with this file.
VERSION seed, units, rights and cleanup scope.
```

## Owning state / operation contracts

### SPEC-001
parseEnvelope(bytes) -> ValidEnvelope | InvalidInput; normalizeDecimal(text, scalePolicy) -> Decimal | InvalidScalar; compareIntervals(a,b) -> ComparableInterval | NonComparable; canonicalDigest(value) -> sha256.

No tables. Normative JSON schemas live under contracts/kernel. IDs are opaque UUID values tagged at runtime with world/realm; counters and monetary values cross JSON as decimal strings. Database identifiers must not be guessable credentials.

[algorithm SPEC-001](../../../docs/algorithms/spec-001.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
