// @zoen-plan packages/ontology/src/effects/effect-reconcile.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/effects/effect-reconcile.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/effects/effect-reconcile.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-023](../../../../docs/specs/spec-023.md).
// Tickets: [ZN-0138](../../../../docs/tickets/zn-0138.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0138 /* planning label, not a public API */
//   OWNER := SPEC-023; TARGET := packages/ontology/src/effects/effect-reconcile.ts
//   REQUIRE accepted dependencies: ZN-0137
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     DERIVE effect identity from DecisionReceipt plus ordinal; bind actual provider contract/idempotency horizon.
//     ACQUIRE a current narrow dispatch permit binding account/destination/body/deadline/epoch/fence and deny state.
//     PERSIST attempt before network; do not hold authority transaction across the provider call.
//     SEND with stable provider idempotency identity when supported; capture actual response or ambiguous transmission evidence.
//     IF transmission may have occurred and provider cannot deduplicate/reconcile safely: Unknown; do not blind-retry.
//     RECONCILE through actual provider status/evidence and record separate Settlement with provenance.
//     DEDUPLICATE callbacks and validate provider account/signature; acceptance, delivery and business settlement are different states.
//     COMPENSATION is a new authorized ActionCase; cancellation cannot claim to undo an already accepted request.
//   TICKET-SPECIFIC SEGMENT:
//     01. Use the admitted provider’s original idempotency/status/history identity.
//     02. Authenticate callbacks and deduplicate by provider/account/event.
//     03. Preserve contradictory or late observations as evidence and create reconciliation cases.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN A partial acceptance callback arrives twice then a contradictory rejection appears
//     WHEN Settlement admission processes them
//     THEN Duplicates do not duplicate state; the contradiction is preserved and flagged rather than overwritten
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
