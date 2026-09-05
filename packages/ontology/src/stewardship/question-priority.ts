// @zoen-plan packages/ontology/src/stewardship/question-priority.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/stewardship/question-priority.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/stewardship/question-priority.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-017](../../../../docs/specs/spec-017.md).
// Tickets: [ZN-0101](../../../../docs/tickets/zn-0101.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0101 /* planning label, not a public API */
//   OWNER := SPEC-017; TARGET := packages/ontology/src/stewardship/question-priority.ts
//   REQUIRE accepted dependencies: ZN-0041, ZN-0062, ZN-0088
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     IDENTIFY unresolved decisions at an authorized basis; compute consequence, deadline and reducibility from declared weights.
//     DEDUPLICATE question by World/subject/predicate/scope/candidate version; suppress stale or inaccessible candidates.
//     ROUTE only to an authorized steward who may see the evidence needed for the question.
//     PIN question digest, candidates and intended answer kind before presentation.
//     RECHECK authority, candidate basis and question freshness when response arrives.
//     DISTINGUISH assertion, identity choice, local decision, reusable-rule proposal and preference; dismissal/unknown is not a vote.
//     APPLY local correction via ordinary operation; reusable changes enter evaluation/publication separately.
//     TRACK unanswered/stopped states and interruption costs without promoting uncertainty to fabricated truth.
//   TICKET-SPECIFIC SEGMENT:
//     01. Implement the transparent rubric and include score components in inspector metadata.
//     02. Deduplicate equivalent questions by candidate version and scope.
//     03. Apply per-person attention budget without hiding unresolved important cases.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN Ten copied mismatches and one delivery uncertainty affecting a near deadline
//     WHEN The queue is built
//     THEN Only one equivalent mismatch question is queued and the consequential deadline question ranks ahead with an explainable basis
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
