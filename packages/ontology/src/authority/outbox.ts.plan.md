# File plan — `packages/ontology/src/authority/outbox.ts`

**Status:** implementation-in-progress; no product acceptance implied.

Target: `packages/ontology/src/authority/outbox.ts`. Representation: **existing-with-sidecar**. Allocation: **required**.

Specs: [SPEC-003](../../../../docs/specs/spec-003.md).
Tickets: [ZN-0023](../../../../docs/tickets/zn-0023.md).

## Responsibility and reuse

The adjacent implementation is preserved. Read it first, extend it in place, and prove behavior at the ticket's required layer. Do not replace it with this plan or create a duplicate primitive.

```text
PROCEDURE ZN_0023 /* planning label, not a public API */
  OWNER := SPEC-003; TARGET := packages/ontology/src/authority/outbox.ts
  REQUIRE accepted dependencies: ZN-0022
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
    01. Claim jobs using bounded batches and lease generation tokens.
    02. Record consumer deduplication by stable event identity before acknowledging handoff.
    03. Reject a zombie worker after successor takeover; keep owner-specific cursors separate.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN A worker dies after consumer admission but before outbox acknowledgement
    WHEN A successor retries the same event and the old worker resumes
    THEN The consumer has one admitted event; the successor can finish; the old fence cannot mark progress or settle work
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
