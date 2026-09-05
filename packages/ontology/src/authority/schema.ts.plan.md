@zoen-plan packages/ontology/src/authority/schema.ts
NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
# File plan — `packages/ontology/src/authority/schema.ts`

**Status:** planned; no product acceptance implied.

Target: `packages/ontology/src/authority/schema.ts`. Representation: **comment-only-source**. Allocation: **required**.

Specs: [SPEC-003](../../../../docs/specs/spec-003.md).
Tickets: [ZN-0019](../../../../docs/tickets/zn-0019.md).

## Responsibility and reuse

```text
PROCEDURE ZN_0019 /* planning label, not a public API */
  OWNER := SPEC-003; TARGET := packages/ontology/src/authority/schema.ts
  REQUIRE accepted dependencies: ZN-0012, ZN-0013
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
    01. Implement required tables and constraints with explicit pg SQL.
    02. Separate DDL owner, authority writer and progress-only roles; parameterize every value.
    03. Version migrations with expand/backfill/validate/contract steps and a no-data-loss rollback plan.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN A fresh database and a populated prior-version fixture
    WHEN Migrations apply, fail midway and resume
    THEN Both paths produce the expected schema without duplicate history; runtime roles cannot execute DDL or progress-write authority rows
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
