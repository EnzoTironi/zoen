# SPEC-001 — Kernel values, contract algebra and canonical encoding

**Milestone:** S0 · **Owner:** Kernel · **Root:** `packages/kernel/src`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Keep the kernel free of business-domain classes and I/O. Use validated opaque IDs, decimal strings, explicit time kinds and total tagged outcomes. Preserve v2 Interpretation status and verification as independent axes.

## Owned state and storage contract
No tables. Normative JSON schemas live under contracts/kernel. IDs are opaque UUID values tagged at runtime with world/realm; counters and monetary values cross JSON as decimal strings. Database identifiers must not be guessable credentials.

## Operations

```text
parseEnvelope(bytes) -> ValidEnvelope | InvalidInput; normalizeDecimal(text, scalePolicy) -> Decimal | InvalidScalar; compareIntervals(a,b) -> ComparableInterval | NonComparable; canonicalDigest(value) -> sha256.
```

## Execution protocol
Validate before branding. Reject duplicate JSON keys and unsupported versions. Authority JSON permits finite I-JSON numbers only for bounded counters/flags; money uses strings. No locale guessing in canonical input. Date is not Instant. Currency/unit conversions require a released factor and evidence/effective interval. Normalize negative zero; preserve declared precision and never use Number for money.

## Pseudocode and file ownership

[algorithm SPEC-001](../algorithms/spec-001.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0007](../tickets/zn-0007.md) | Define branded IDs and realm-safe boundary parsers | law | [ZN-0006](../tickets/zn-0006.md) |
| [ZN-0008](../tickets/zn-0008.md) | Implement decimal, money and unit algebra | law | [ZN-0007](../tickets/zn-0007.md) |
| [ZN-0009](../tickets/zn-0009.md) | Implement time kinds and half-open intervals | law | [ZN-0008](../tickets/zn-0008.md) |
| [ZN-0010](../tickets/zn-0010.md) | Implement bounded canonical parsing and hashing | law | [ZN-0009](../tickets/zn-0009.md) |
| [ZN-0011](../tickets/zn-0011.md) | Define stable errors, state axes and exhaustive serializers | law | [ZN-0010](../tickets/zn-0010.md) |
| [ZN-0012](../tickets/zn-0012.md) | Prove algebraic and resource-limit laws | law | [ZN-0011](../tickets/zn-0011.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `ontology-and-standards.md`, `types-and-protocols.md`, `identity-and-time.md`. Read a named historical reference only when needed; it cannot override current contracts.
