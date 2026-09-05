// @zoen-plan packages/ontology/src/identity/identity-laws.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/identity/identity-laws.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/identity/identity-laws.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-006](../../../../docs/specs/spec-006.md).
// Tickets: [ZN-0041](../../../../docs/tickets/zn-0041.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0041 /* planning label, not a public API */
//   OWNER := SPEC-006; TARGET := packages/ontology/src/identity/identity-laws.ts
//   REQUIRE accepted dependencies: ZN-0040
//   REQUIRE evidence layer: law; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     GENERATE candidate links from authorized source identities and released match rules; similarity alone cannot merge.
//     PIN candidate set, evidence, valid interval and knowledge cut into a ResolutionCase.
//     RECHECK current authority and unchanged candidate basis before accepting same-as/different-from.
//     APPEND a scoped identity assertion and revision through the shared authority path; preserve original source subjects.
//     COMPUTE a representative at the requested cut without rewriting source IDs.
//     FOR split: append counter-assertions, recalculate identity-dependent interpretations and invalidate dependent Cases.
//     NEVER union permissions because subjects merge; re-evaluate rights per original source and resource.
//     EXPLAIN historical resolutions from authorized evidence without leaking hidden candidates.
//   TICKET-SPECIFIC SEGMENT:
//     01. Generate rename, alias collision, merge, split and backdated-correction sequences.
//     02. Assert label changes preserve semantic IDs and permission non-escalation.
//     03. Keep valid-time and knowledge-time query assertions separate.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN A label rename and a retroactive identity correction recorded at a later cut
//     WHEN Historical and current queries execute
//     THEN The rename never changes identity; old knowledge cuts do not gain future information and current cuts show the correction with provenance
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
