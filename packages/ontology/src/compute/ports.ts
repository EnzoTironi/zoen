// @zoen-plan packages/ontology/src/compute/ports.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/compute/ports.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/compute/ports.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-034](../../../../docs/specs/spec-034.md).
// Tickets: [ZN-0197](../../../../docs/tickets/zn-0197.md), [ZN-0198](../../../../docs/tickets/zn-0198.md), [ZN-0199](../../../../docs/tickets/zn-0199.md), [ZN-0200](../../../../docs/tickets/zn-0200.md).
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
// ### SPEC-034
// ExecuteVirtualRead(plan,lease) -> CapturedResult | ReferenceOnlyResult; SubmitCompute(profile,artifact,inputs,budget) -> Run; ObserveCompute(run) -> State; AdmitComputeOutput(run) -> AnalysisOrDatasetProposal.
//
// jobs.compute_runs(run_id PK,world_id,engine_profile,input_cut,artifact_digest,budget_ref,state,output_ref,usage); ontology.virtual_reads(read_id PK,world_id,source_binding,query_digest,external_snapshot_ref,observed_at,coverage,rights_ref,capture_ref_nullable). Engine configuration and scale parameters are versioned runtime data under an admitted adapter ABI.
//
// [algorithm SPEC-034](../../../../docs/algorithms/spec-034.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
