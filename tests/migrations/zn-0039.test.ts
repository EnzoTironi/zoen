// @zoen-plan tests/migrations/zn-0039.test.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `tests/migrations/zn-0039.test.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `tests/migrations/zn-0039.test.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-006](../../docs/specs/spec-006.md).
// Tickets: [ZN-0039](../../docs/tickets/zn-0039.md).
//
// ## Responsibility and reuse
//
// ```text
// CONDITIONAL SUPPORT SEGMENT.
// FIRST prove this file is needed by an owning ticket; do not implement parallel abstractions merely to fill paths.
// READ the current implementation and shared module algorithm; select only the missing support responsibility.
// KEEP dependency direction and single authority ownership; no provider success stub or ambient credential.
// WIRE into the owning ticket's declared entry and prove its exact tests.
// ```
//
// ## Owning state / operation contracts
//
// ### SPEC-006
// ProposeIdentityResolution(candidates,basis) -> ResolutionCase; ResolveIdentity(caseId,choice,operationId) -> IdentityReceipt; ExplainIdentity(subject,cut) -> AuthorizedIdentityFrame.
//
// ontology.subjects(subject_id PK,world_id,created_commit); ontology.aliases(world_id,binding_id,namespace,external_id,valid_from PK,subject_ref,assertion_ref); ontology.identity_assertions(assertion_id PK,world_id,left_subject,right_subject,relation,valid_interval,knowledge_version,evidence_refs,supersedes); ontology.identity_cases(case_id PK,world_id,candidate_digest,basis_ref,state). No unique constraint on display name or email alone.
//
// [algorithm SPEC-006](../../docs/algorithms/spec-006.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
