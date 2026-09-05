// @zoen-plan packages/ontology/src/flows/index.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/flows/index.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/flows/index.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-032](../../../../docs/specs/spec-032.md).
// Tickets: [ZN-0186](../../../../docs/tickets/zn-0186.md), [ZN-0187](../../../../docs/tickets/zn-0187.md), [ZN-0188](../../../../docs/tickets/zn-0188.md), [ZN-0189](../../../../docs/tickets/zn-0189.md), [ZN-0190](../../../../docs/tickets/zn-0190.md).
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
// ### SPEC-032
// RunFlow(definition,inputs) -> FlowRun; CheckpointPartition(run,partition,fence,cursor) -> Progress; EvaluateQuality(check,inputCoverage) -> pass|fail|unknown; ProposeFlowPublication(run) -> DatasetProposal | Blocked.
//
// ontology.flow_definitions are released data; jobs.flow_runs(run_id PK,world_id,definition_digest,input_cut,state,attempt,budget_ref); jobs.flow_partitions(run_id,partition PK,cursor,watermark,gaps_json,fence,state); ontology.lineage_edges(output_ref,input_ref,field_mapping_digest PK); ontology.quality_results(result_id PK,run_id,check_id,status,coverage,details_ref).
//
// [algorithm SPEC-032](../../../../docs/algorithms/spec-032.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
