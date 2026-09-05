// @zoen-plan packages/ontology/src/identity/ports.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/identity/ports.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/identity/ports.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-006](../../../../docs/specs/spec-006.md).
// Tickets: [ZN-0037](../../../../docs/tickets/zn-0037.md), [ZN-0038](../../../../docs/tickets/zn-0038.md), [ZN-0039](../../../../docs/tickets/zn-0039.md), [ZN-0040](../../../../docs/tickets/zn-0040.md), [ZN-0041](../../../../docs/tickets/zn-0041.md).
//
// ## Responsibility and reuse
//
// ```text
// CONTRACT SURFACE PLAN.
// DEFINE only the owning module's input/output/error/state and dependency-port types.
// REUSE branded kernel values, verified context, common semantic envelope and typed results.
// DO NOT export repositories or broad credentials to clients; authority context is server verified.
// SEPARATE versioned semantic meaning from transport metadata and immutable artifacts from mutable runtime state.
// VERIFY consumers use the same contracts and exhaustive tagged outcomes; unsupported shapes fail closed.
// ```
//
// ## Owning state / operation contracts
//
// ### SPEC-006
// ProposeIdentityResolution(candidates,basis) -> ResolutionCase; ResolveIdentity(caseId,choice,operationId) -> IdentityReceipt; ExplainIdentity(subject,cut) -> AuthorizedIdentityFrame.
//
// ontology.subjects(subject_id PK,world_id,created_commit); ontology.aliases(world_id,binding_id,namespace,external_id,valid_from PK,subject_ref,assertion_ref); ontology.identity_assertions(assertion_id PK,world_id,left_subject,right_subject,relation,valid_interval,knowledge_version,evidence_refs,supersedes); ontology.identity_cases(case_id PK,world_id,candidate_digest,basis_ref,state). No unique constraint on display name or email alone.
//
// [algorithm SPEC-006](../../../../docs/algorithms/spec-006.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
