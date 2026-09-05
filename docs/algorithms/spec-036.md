# SPEC-036 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-036](../specs/spec-036.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Analytics**. Module: `packages/ontology/src/scenarios`. Milestone: **S8**.

## Normative operation signatures

```text
CreateScenario(base,assumptions) -> Scenario; RunScenario(scenario,analysis) -> HypotheticalResult; CompareScenarios(ids,metric) -> ComparisonFrame; ProposeFromScenario(resultRef,currentGrant) -> FreshLiveCase; AdmitModelArtifact(manifest,eval) -> CandidateModel.
```

## State and transaction contract

ontology.scenarios(scenario_id PK,world_id,base_cut,assumptions_ref,analysis_refs,state,rights_label); ontology.model_artifacts(model_digest PK,training_manifest,code_digest,evaluation_ref,rights_label,retention_policy,admission_state); ontology.scenario_comparisons(comparison_id PK,scenario_refs,metric_definition,coverage,output_ref).

## Shared algorithm

```text
REOPEN exact authorized input Frames/datasets and record model/code/environment/seed provenance.
CREATE scenario overlay in isolated read-only analytical state; hypothetical values remain labeled assumptions.
RUN only admitted pure/isolated analysis with bounded resources and allowed model/data-use rights.
RECORD output uncertainty, scope, lineage and validity; model prediction is not an observed fact.
COMPARE scenario against its pinned baseline without mutating the live World.
FOR apply: reopen fresh live authority and form a new ActionCase with current guards/approval.
REJECT scenario tokens as live grants; do not carry stale consent from simulation to execution.
EVALUATE model changes through artifacts/releases with data leakage checks and measured rather than asserted performance.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0207](../tickets/zn-0207.md) | Implement scenario branches and hypothetical data overlays | [packages/ontology/src/scenarios/scenario-store.ts](../../packages/ontology/src/scenarios/scenario-store.ts) |
| [ZN-0208](../tickets/zn-0208.md) | Compare scenarios with explicit basis and coverage | [packages/ontology/src/scenarios/scenario-compare.ts](../../packages/ontology/src/scenarios/scenario-compare.ts) |
| [ZN-0209](../tickets/zn-0209.md) | Create a fresh live Case from a hypothetical result | [packages/ontology/src/scenarios/scenario-apply.ts](../../packages/ontology/src/scenarios/scenario-apply.ts) |
| [ZN-0210](../tickets/zn-0210.md) | Implement notebook and training data-use admission | [packages/ontology/src/scenarios/training-manifest.ts](../../packages/ontology/src/scenarios/training-manifest.ts) |
| [ZN-0211](../tickets/zn-0211.md) | Register and evaluate versioned model artifacts | [packages/ontology/src/scenarios/model-registry.ts](../../packages/ontology/src/scenarios/model-registry.ts) |
| [ZN-0212](../tickets/zn-0212.md) | Prove point-in-time analysis and scenario isolation | [tests/journey/spec-036/scenario-journey.test.ts](../../tests/journey/spec-036/scenario-journey.test.ts) |

## Required proof boundaries

Display hypothetical status, source cut, assumptions and uncertainty in every surface. A scenario cannot carry live effect leases. Point-in-time analysis excludes later revisions/identity mappings unless explicitly labeled. Training requires input rights for that purpose, is off across customers by default, and produces lineage-bound artifacts that can be recalled when data-use obligations change.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
