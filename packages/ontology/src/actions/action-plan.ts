// @zoen-plan packages/ontology/src/actions/action-plan.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/actions/action-plan.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/actions/action-plan.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-022](../../../../docs/specs/spec-022.md).
// Tickets: [ZN-0129](../../../../docs/tickets/zn-0129.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0129 /* planning label, not a public API */
//   OWNER := SPEC-022; TARGET := packages/ontology/src/actions/action-plan.ts
//   REQUIRE accepted dependencies: ZN-0088, ZN-0111, ZN-0123
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     RESOLVE released action and current permission; read preconditions through the shared semantic executor.
//     PLAN bounded local writes, reservations and effect templates without executing external requests.
//     FREEZE arguments, recipient, amounts, consequences, expiry and complete read guards into one Case digest.
//     PRESENT server-authorized Case in trusted host/chat confirmation; guest approval=true is not consent.
//     COLLECT approvals for the exact revision/digest; recheck each approver's current authority and assurance.
//     AT final quorum recheck time, head, policy, predicate and observed-value guards; any relevant change => Stale.
//     COMMIT through AuthorityCommit once: writes, receipt, stable EffectIntents and outbox; no network in transaction.
//     CANCEL and denial remain explicit; never silently refresh intent after consent or equate local commitment to external success.
//   TICKET-SPECIFIC SEGMENT:
//     01. Resolve released reads/writes/effects into typed bounded plans.
//     02. Capture complete guards including absence predicates and ClockSample expiry.
//     03. Emit user-readable consequences, uncertainty, reversibility and requested effects.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN A supplier purchase proposes recipient A, amount 50.00 and an expiry
//     WHEN The client changes recipient or amount after preview
//     THEN The saved Case digest no longer matches; the original approval cannot authorize the altered operation
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
