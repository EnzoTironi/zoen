# File plan — `contracts/spec-001/scalars.schema.json`

**Status:** planned; no product acceptance implied.

Target: `contracts/spec-001/scalars.schema.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-001](../../docs/specs/spec-001.md).
Tickets: [ZN-0008](../../docs/tickets/zn-0008.md).

## Responsibility and reuse

```text
CONDITIONAL SCHEMA PLAN — no permissive {} schema or fabricated generated types.
RESOLVE exact input/output/tagged-error fields from the operation signatures and common protocol.
REQUIRE bounded sizes/depth/arrays, exact discriminants, validated IDs and explicit optional/null distinctions.
REJECT additional or authority-bearing client fields; money/counters stay strings where required.
GENERATE canonical fixtures, wire types and surface descriptors from this single reviewed schema source.
TEST malformed/oversized/unknown-version inputs and exact round trips; registry presence alone is not a pass.
```

## Owning state / operation contracts

### SPEC-001
parseEnvelope(bytes) -> ValidEnvelope | InvalidInput; normalizeDecimal(text, scalePolicy) -> Decimal | InvalidScalar; compareIntervals(a,b) -> ComparableInterval | NonComparable; canonicalDigest(value) -> sha256.

No tables. Normative JSON schemas live under contracts/kernel. IDs are opaque UUID values tagged at runtime with world/realm; counters and monetary values cross JSON as decimal strings. Database identifiers must not be guessable credentials.

[algorithm SPEC-001](../../docs/algorithms/spec-001.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
