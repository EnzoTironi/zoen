// @zoen-plan packages/ontology/src/mandates/mandate-stop.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/mandates/mandate-stop.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/mandates/mandate-stop.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-024](../../../../docs/specs/spec-024.md).
// Tickets: [ZN-0144](../../../../docs/tickets/zn-0144.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0144 /* planning label, not a public API */
//   OWNER := SPEC-024; TARGET := packages/ontology/src/mandates/mandate-stop.ts
//   REQUIRE accepted dependencies: ZN-0143
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     AUTHORIZE goal, permitted action set, deadline, observation rule and resource ceilings.
//     LOCK root-to-child budget/reservation path deterministically; verify aggregate capacity, not cached balance.
//     RESERVE before scheduling children/steps; child scope and total budget cannot exceed parent.
//     USE ordinary ActionCases for consequential steps and preserve stable effect identities across recovery.
//     OBSERVE goal using authorized evidence; tool completion alone cannot mark goal achieved.
//     KEEP reservations for ambiguous costly/financial effects until actual evidence and policy justify reconciliation.
//     STOP/escalate on revoked scope, deadline, repeat failure, missing observation or resource bound.
//     RETURN achieved/failed/unknown/stopped distinctly with receipts and unresolved external outcomes.
//   TICKET-SPECIFIC SEGMENT:
//     01. Persist stop state, revoke new child/effect permits and cancel unsent steps.
//     02. Escalate repeated unsuccessful plans with authorized evidence and remaining budget.
//     03. Reconcile in-flight external requests rather than claiming immediate recall.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN A mandate expires during a transmitted-unknown effect and another child requests work
//     WHEN The scheduler ticks
//     THEN No new child action is allowed; unknown exposure remains reserved and an explicit escalation is recorded
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
