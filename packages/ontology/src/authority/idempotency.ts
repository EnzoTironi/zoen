// @zoen-plan packages/ontology/src/authority/idempotency.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/authority/idempotency.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/authority/idempotency.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-003](../../../../docs/specs/spec-003.md).
// Tickets: [ZN-0021](../../../../docs/tickets/zn-0021.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0021 /* planning label, not a public API */
//   OWNER := SPEC-003; TARGET := packages/ontology/src/authority/idempotency.ts
//   REQUIRE accepted dependencies: ZN-0020
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     INPUT: verified context, unchanged operation ID/intent, expected head, read guards and a typed local plan.
//     BEGIN SERIALIZABLE; acquire head share lock; check cell epoch, release/generation and current security state.
//     AUTHORIZE current principal/purpose before looking up or disclosing idempotent results.
//     LOOK UP scoped operation key; changed digest => Conflict; same intent => reauthorize stored result before return.
//     LOCK affected domains in sorted order; validate predicate/absence, identity, source watermark, time and policy guards.
//     IF relevant dependency changed: Stale; do not recompute an approved intent or partially write a receipt.
//     COMMIT local writes, domain counters, operation result, receipt and stable outbox identities together; no model/provider I/O inside transaction.
//     RETRY only admitted serialization/deadlock failures, at most three attempts, with same intent; ambiguous commit acknowledgement => Unknown and reconcile.
//     CLAIM outbox in bounded fenced leases; consumer records deduplication before acknowledgement; reject obsolete workers.
//   TICKET-SPECIFIC SEGMENT:
//     01. Store canonical intent digest under World/principal/operation/key.
//     02. Resolve the unique-key race by retrying and reading the winner under current rights.
//     03. Reject changed intent and redact stored output if current access has narrowed.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN Two equal requests, a changed-amount request with the same key and a later revocation
//     WHEN All replay the operation
//     THEN Equal requests yield one semantic result; changed intent conflicts; revocation prevents disclosure of the prior result
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
