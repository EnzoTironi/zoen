# File plan — `packages/ontology/src/authority/guards.ts`

**Status:** candidate-unaccepted; no product acceptance implied.

Target: `packages/ontology/src/authority/guards.ts`. Representation: **existing-with-sidecar**. Allocation: **required**.

Specs: [SPEC-003](../../../../docs/specs/spec-003.md).
Tickets: [ZN-0019](../../../../docs/tickets/zn-0019.md), [ZN-0020](../../../../docs/tickets/zn-0020.md), [ZN-0021](../../../../docs/tickets/zn-0021.md), [ZN-0022](../../../../docs/tickets/zn-0022.md), [ZN-0023](../../../../docs/tickets/zn-0023.md).

## Responsibility and reuse

The adjacent implementation is preserved. Read it first, extend it in place, and prove behavior at the ticket's required layer. Do not replace it with this plan or create a duplicate primitive.

```text
PROCEDURE ZN_0022 /* planning label, not a public API */
  OWNER := SPEC-003; TARGET := packages/ontology/src/authority/guards.ts
  REQUIRE accepted dependencies: ZN-0021
  REQUIRE evidence layer: component; actual admitted services when needed
  IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
  IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
  USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
    INPUT: verified context, unchanged operation ID/intent, expected head, read guards and a typed local plan.
    BEGIN SERIALIZABLE; acquire head share lock; check cell epoch, release/generation and current security state.
    AUTHORIZE current principal/purpose before looking up or disclosing idempotent results.
    LOOK UP scoped operation key; changed digest => Conflict; same intent => reauthorize stored result before return.
    LOCK affected domains in sorted order; validate predicate/absence, identity, source watermark, time and policy guards.
    IF relevant dependency changed: Stale; do not recompute an approved intent or partially write a receipt.
    COMMIT local writes, domain counters, operation result, receipt and stable outbox identities together; no model/provider I/O inside transaction.
    RETRY only admitted serialization/deadlock failures, at most three attempts, with same intent; ambiguous commit acknowledgement => Unknown and reconcile.
    CLAIM outbox in bounded fenced leases; consumer records deduplication before acknowledgement; reject obsolete workers.
  TICKET-SPECIFIC SEGMENT:
    01. Record conservative predicate/domain fences for every count, absence or aggregate dependency.
    02. Include source watermark, identity revision, clock expiry and policy/head versions.
    03. Return Stale without recomputing the approved intent when any guard is invalid.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN A Case approved because no unpaid invoice exists; a matching invoice is inserted without updating previously read rows
    WHEN Commit rechecks the saved guards
    THEN It returns Stale and produces no receipt/effect; insertion outside the declared dependency domain does not unnecessarily invalidate an unrelated Case
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
