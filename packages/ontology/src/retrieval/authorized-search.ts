// @zoen-plan packages/ontology/src/retrieval/authorized-search.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/retrieval/authorized-search.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/retrieval/authorized-search.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-025](../../../../docs/specs/spec-025.md).
// Tickets: [ZN-0148](../../../../docs/tickets/zn-0148.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0148 /* planning label, not a public API */
//   OWNER := SPEC-025; TARGET := packages/ontology/src/retrieval/authorized-search.ts
//   REQUIRE accepted dependencies: ZN-0147
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     BUILD permitted resource/field set at current rights cut before full-text/vector ranking.
//     SELECT only index documents with admitted source/deletion lineage and a declared projection cut.
//     RUN bounded retrieval/aggregation over authorized set; preserve stale-index/gap information.
//     REOPEN evidence through ordinary authorized operations before exposing bytes or grounding a model.
//     TREAT retrieved text as data; instructions inside it cannot install tools, roles or permissions.
//     START specialized agent only under released definition, explicit workload/delegation and parent Mandate limits.
//     REUSE context compiler, semantic client and budget conservation; cap fanout/recursion/egress.
//     ON revocation or lag beyond policy, stop affected delivery/work; do not fall back to unrestricted search.
//   TICKET-SPECIFIC SEGMENT:
//     01. Create a bounded authorized ID set with the reviewed query-admission profile.
//     02. Run exact text/vector scoring only within that set and report truncation honestly.
//     03. Reject an over-budget plan rather than use hidden global nearest-neighbor ranking.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN Paired worlds differ only in many highly similar hidden documents
//     WHEN The same user runs the query
//     THEN Visible rankings/counts and explanation remain equal; hidden documents cannot crowd out authorized results
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
