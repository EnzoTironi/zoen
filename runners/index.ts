// @zoen-plan runners/index.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `runners/index.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `runners/index.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-030](../docs/specs/spec-030.md).
// Tickets: [ZN-0174](../docs/tickets/zn-0174.md), [ZN-0175](../docs/tickets/zn-0175.md), [ZN-0176](../docs/tickets/zn-0176.md), [ZN-0177](../docs/tickets/zn-0177.md), [ZN-0178](../docs/tickets/zn-0178.md).
//
// ## Responsibility and reuse
//
// ```text
// COMPOSITION/REGISTRATION PLAN.
// IMPORT only reviewed implemented ports and adapters under the existing dependency direction.
// BIND the existing semantic executor once; register this module's released operation descriptors.
// DO NOT add business rules, source credentials, alternate policy evaluators or a second dispatcher here.
// GATE unavailable capabilities explicitly; an unwired implementation does not satisfy a ticket.
// KEEP shared composition edits under the named exclusive lock.
// ```
//
// ## Owning state / operation contracts
//
// ### SPEC-030
// AcquireExecutionLease(installation,inputRefs,scope) -> Lease; BrokerRead(lease,resource) -> BoundedInput; BrokerCall(lease,capability,args) -> Observation; RunAnalysis(lease,artifact) -> AnalysisArtifact | Failed | Unknown.
//
// ontology.execution_leases(lease_id PK,world_id,artifact_digest,principal,purpose,allowed_ops,input_refs,budget_ref,expires_at,epoch,state); jobs.runner_attempts(attempt_id PK,lease_id,host_profile,fence,state,output_ref,usage); ontology.analysis_artifacts(analysis_id PK,world_id,code_digest,input_cut,seed_nullable,determinism,output_ref,lineage,rights_label).
//
// [algorithm SPEC-030](../docs/algorithms/spec-030.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
