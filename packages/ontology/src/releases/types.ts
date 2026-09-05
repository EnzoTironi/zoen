// @zoen-plan packages/ontology/src/releases/types.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/releases/types.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/releases/types.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-014](../../../../docs/specs/spec-014.md).
// Tickets: [ZN-0082](../../../../docs/tickets/zn-0082.md), [ZN-0083](../../../../docs/tickets/zn-0083.md), [ZN-0084](../../../../docs/tickets/zn-0084.md), [ZN-0085](../../../../docs/tickets/zn-0085.md), [ZN-0086](../../../../docs/tickets/zn-0086.md), [ZN-0087](../../../../docs/tickets/zn-0087.md).
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
// ### SPEC-014
// ProposeDefinitionChange(base,patch,operationId) -> Change; EvaluateChange(change) -> ReleaseProof; PrepareActivation(change,world) -> PreparedActivation; ApproveChange(change,digest) -> Approval; ActivateRelease(proof,preparation,approval,operationId) -> ActivationReceipt | PreparationStale.
//
// ontology.changes(change_id PK,world_id,base_release,candidate_release,risk,state,author,version); ontology.release_proofs(proof_id PK,release_digest,kernel_image,evaluation_world,cut_digest,report_ref,missing_attestations); ontology.preparations(preparation_id PK,world_id,expected_head,target_release,target_generation,through_cut,open_work_disposition,state); ontology.release_approvals(change_id,principal_id,case_digest PK,policy_basis); ontology.activations(receipt_id PK,world_id,old_head,new_head,proof_ref,preparation_ref). Evaluation namespaces and credentials are separate.
//
// [algorithm SPEC-014](../../../../docs/algorithms/spec-014.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
