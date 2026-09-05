// @zoen-plan packages/ontology/src/identity/merge.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/identity/merge.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/identity/merge.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-006](../../../../docs/specs/spec-006.md).
// Tickets: [ZN-0039](../../../../docs/tickets/zn-0039.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0039 /* planning label, not a public API */
//   OWNER := SPEC-006; TARGET := packages/ontology/src/identity/merge.ts
//   REQUIRE accepted dependencies: ZN-0038
//   REQUIRE evidence layer: component; actual admitted services when needed
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
//     01. Append a same-as assertion and receipt under current policy.
//     02. Preserve every original source subject and claim reference.
//     03. Recompute representatives and affected guards at the new cut only.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN Two subjects with separate grants and historical claims
//     WHEN An authorized steward merges their identity
//     THEN The new identity view joins meaning without granting access to either subject’s forbidden evidence; old cuts preserve the old representatives
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
