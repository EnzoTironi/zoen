# File plan — `tests/fixtures/spec-036/scenario-journey.json`

**Status:** planned; no product acceptance implied.

Target: `tests/fixtures/spec-036/scenario-journey.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-036](../../../docs/specs/spec-036.md).
Tickets: [ZN-0212](../../../docs/tickets/zn-0212.md).

## Responsibility and reuse

```text
CONDITIONAL INPUT FIXTURE PLAN — not an observed service result.
USE synthetic records within owned disposable namespaces and explicit valid/knowledge time.
INCLUDE comparable rivals, a denied source, duplicate provenance family and stale dependency when in scope.
COMPUTE fixed expected values from the owning oracle, not from the implementation under test.
LOAD through the real component/journey boundary; do not replace provider/database behavior with this file.
VERSION seed, units, rights and cleanup scope.
```

## Owning state / operation contracts

### SPEC-036
CreateScenario(base,assumptions) -> Scenario; RunScenario(scenario,analysis) -> HypotheticalResult; CompareScenarios(ids,metric) -> ComparisonFrame; ProposeFromScenario(resultRef,currentGrant) -> FreshLiveCase; AdmitModelArtifact(manifest,eval) -> CandidateModel.

ontology.scenarios(scenario_id PK,world_id,base_cut,assumptions_ref,analysis_refs,state,rights_label); ontology.model_artifacts(model_digest PK,training_manifest,code_digest,evaluation_ref,rights_label,retention_policy,admission_state); ontology.scenario_comparisons(comparison_id PK,scenario_refs,metric_definition,coverage,output_ref).

[algorithm SPEC-036](../../../docs/algorithms/spec-036.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
