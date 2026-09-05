// @zoen-plan packages/ontology/src/authority/ports.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/authority/ports.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/authority/ports.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-003](../../../../docs/specs/spec-003.md).
// Tickets: [ZN-0019](../../../../docs/tickets/zn-0019.md), [ZN-0020](../../../../docs/tickets/zn-0020.md), [ZN-0021](../../../../docs/tickets/zn-0021.md), [ZN-0022](../../../../docs/tickets/zn-0022.md), [ZN-0023](../../../../docs/tickets/zn-0023.md).
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
// ### SPEC-003
// AuthorityCommit(context, expectedHead, guards, operationKey, typedPlan) -> Receipt | Stale | Conflict; ProgressCommit(leaseToken,progress) -> Progress | LostLease; ClaimOutbox(owner,limit) -> FencedBatch.
//
// ontology.domains(world_id,domain_id PK,version bigint>=0); ontology.operations(world_id,principal_id,semantic_op,operation_id PK,intent_digest,result_ref,commit_id); ontology.commits(commit_id PK,world_id,head_digest,touched_domains jsonb,recorded_at); ontology.receipts(receipt_id PK,world_id,commit_id,kind,payload_digest,payload_json); jobs.outbox(outbox_id PK,owner,world_id,commit_id,event_ordinal,payload_ref,status,lease_owner,fence,lease_until,UNIQUE(owner,commit_id,event_ordinal)). All world references include realm and ownership checks.
//
// [algorithm SPEC-003](../../../../docs/algorithms/spec-003.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
