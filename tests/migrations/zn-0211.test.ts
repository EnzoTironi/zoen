// @zoen-plan tests/migrations/zn-0211.test.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `tests/migrations/zn-0211.test.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `tests/migrations/zn-0211.test.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-036](../../docs/specs/spec-036.md).
// Tickets: [ZN-0211](../../docs/tickets/zn-0211.md).
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
// ### SPEC-036
// CreateScenario(base,assumptions) -> Scenario; RunScenario(scenario,analysis) -> HypotheticalResult; CompareScenarios(ids,metric) -> ComparisonFrame; ProposeFromScenario(resultRef,currentGrant) -> FreshLiveCase; AdmitModelArtifact(manifest,eval) -> CandidateModel.
//
// ontology.scenarios(scenario_id PK,world_id,base_cut,assumptions_ref,analysis_refs,state,rights_label); ontology.model_artifacts(model_digest PK,training_manifest,code_digest,evaluation_ref,rights_label,retention_policy,admission_state); ontology.scenario_comparisons(comparison_id PK,scenario_refs,metric_definition,coverage,output_ref).
//
// [algorithm SPEC-036](../../docs/algorithms/spec-036.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
