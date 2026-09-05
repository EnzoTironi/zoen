# File plan — `packages/kernel/src/result.ts`

**Status:** implementation-in-progress; no product acceptance implied.

Target: `packages/kernel/src/result.ts`. Representation: **existing-with-sidecar**. Allocation: **required**.

Specs: [SPEC-001](../../../docs/specs/spec-001.md).
Tickets: [ZN-0011](../../../docs/tickets/zn-0011.md).

## Responsibility and reuse

The adjacent implementation is preserved. Read it first, extend it in place, and prove behavior at the ticket's required layer. Do not replace it with this plan or create a duplicate primitive.

```text
PROCEDURE ZN_0011 /* planning label, not a public API */
  OWNER := SPEC-001; TARGET := packages/kernel/src/result.ts
  REQUIRE accepted dependencies: ZN-0010
  REQUIRE evidence layer: law; actual admitted services when needed
  IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
  IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
  USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
    INPUT: untrusted bytes or scalar plus explicit schema, precision, unit and temporal policy.
    CHECK byte/depth/entry limits before recursive parsing; reject duplicate keys, invalid Unicode and remote schema references.
    PARSE IDs before branding; bind World and realm, never treat an opaque ID as authorization.
    NORMALIZE decimals with exact arithmetic, explicit rounding and checked scale/overflow; zero and missing remain different.
    COMPARE units only with equal dimensions/currency or a released evidenced conversion; never guess locale.
    PARSE Instant, LocalDate and wall time as different types; require an explicit choice for ambiguous wall time.
    CANONICALIZE admitted values deterministically and hash actual canonical bytes; no network or environment access.
    RETURN tagged errors without partial branding; preserve counterexamples for generated-law tests.
  TICKET-SPECIFIC SEGMENT:
    01. Implement common result/error unions from architecture/protocol-contract.md.
    02. Keep selected, contested and verification independent; missing, zero, false and deleted remain distinct.
    03. Add exhaustive serialization tests and backwards-compatible schema fixtures.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN A selected but contested unverified interpretation plus a literal zero amount
    WHEN The result crosses JSON and TypeScript boundaries
    THEN All axes survive unchanged and zero never becomes unknown; unknown discriminants fail explicitly
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
