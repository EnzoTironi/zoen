// @zoen-plan tests/migrations/zn-0175.test.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `tests/migrations/zn-0175.test.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `tests/migrations/zn-0175.test.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-030](../../docs/specs/spec-030.md).
// Tickets: [ZN-0175](../../docs/tickets/zn-0175.md).
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
// ### SPEC-030
// AcquireExecutionLease(installation,inputRefs,scope) -> Lease; BrokerRead(lease,resource) -> BoundedInput; BrokerCall(lease,capability,args) -> Observation; RunAnalysis(lease,artifact) -> AnalysisArtifact | Failed | Unknown.
//
// ontology.execution_leases(lease_id PK,world_id,artifact_digest,principal,purpose,allowed_ops,input_refs,budget_ref,expires_at,epoch,state); jobs.runner_attempts(attempt_id PK,lease_id,host_profile,fence,state,output_ref,usage); ontology.analysis_artifacts(analysis_id PK,world_id,code_digest,input_cut,seed_nullable,determinism,output_ref,lineage,rights_label).
//
// [algorithm SPEC-030](../../docs/algorithms/spec-030.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
