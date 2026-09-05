// @zoen-plan packages/ontology/src/mandates/mandate-contract.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/mandates/mandate-contract.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/mandates/mandate-contract.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-024](../../../../docs/specs/spec-024.md).
// Tickets: [ZN-0142](../../../../docs/tickets/zn-0142.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0142 /* planning label, not a public API */
//   OWNER := SPEC-024; TARGET := packages/ontology/src/mandates/mandate-contract.ts
//   REQUIRE accepted dependencies: ZN-0141
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
//     01. Require observable goal, authorized scope/actions, deadline, budgets and stop/escalation policy.
//     02. Reject free-form unlimited goals without an evaluation contract.
//     03. Derive child scopes as narrowing only.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN An agent proposes keep trying until success with no deadline or spend limit
//     WHEN CreateMandate validates it
//     THEN The request is rejected; a properly bounded mandate is created with user-visible limits
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
