// @zoen-plan packages/ontology/src/cells/ports.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/cells/ports.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/cells/ports.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-042](../../../../docs/specs/spec-042.md).
// Tickets: [ZN-0245](../../../../docs/tickets/zn-0245.md), [ZN-0246](../../../../docs/tickets/zn-0246.md), [ZN-0247](../../../../docs/tickets/zn-0247.md), [ZN-0248](../../../../docs/tickets/zn-0248.md).
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
// ### SPEC-042
// PrepareMove(world,destination) -> StagedReplica; FenceSource(world,epoch) -> FenceReceipt; PromoteWorld(fence,destinationProof,expectedDirectory) -> NewEpoch; AdmitBoot(world,cell,epoch) -> WriteAdmission | ReadOnly.
//
// control.world_directory(world_id,realm PK,cell_id,epoch,region,state,version); control.promotions(promotion_id PK,world_id,source_epoch,target_epoch,source_fence_receipt,destination_proof,state); ontology.local_authority(world_id PK,installed_epoch,write_enabled,fence_receipt,boot_admission); jobs.migration_runs(run_id PK,world_id,source_cut,target_cut,validation_ref,state). Directory is a single-writer durable control store, not a grant database.
//
// [algorithm SPEC-042](../../../../docs/algorithms/spec-042.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
