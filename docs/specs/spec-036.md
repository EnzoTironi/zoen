# SPEC-036 — Read-only scenarios, notebooks and evaluated model artifacts

**Milestone:** S8 · **Owner:** Analytics · **Root:** `packages/ontology/src/scenarios`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Scenarios branch hypothetical assumptions from an explicit retained basis without live effects. Notebooks and training runs are isolated analyses with data-use lineage. Applying a recommendation always creates a fresh live Case against current facts.

## Owned state and storage contract
ontology.scenarios(scenario_id PK,world_id,base_cut,assumptions_ref,analysis_refs,state,rights_label); ontology.model_artifacts(model_digest PK,training_manifest,code_digest,evaluation_ref,rights_label,retention_policy,admission_state); ontology.scenario_comparisons(comparison_id PK,scenario_refs,metric_definition,coverage,output_ref).

## Operations

```text
CreateScenario(base,assumptions) -> Scenario; RunScenario(scenario,analysis) -> HypotheticalResult; CompareScenarios(ids,metric) -> ComparisonFrame; ProposeFromScenario(resultRef,currentGrant) -> FreshLiveCase; AdmitModelArtifact(manifest,eval) -> CandidateModel.
```

## Execution protocol
Display hypothetical status, source cut, assumptions and uncertainty in every surface. A scenario cannot carry live effect leases. Point-in-time analysis excludes later revisions/identity mappings unless explicitly labeled. Training requires input rights for that purpose, is off across customers by default, and produces lineage-bound artifacts that can be recalled when data-use obligations change.

## Pseudocode and file ownership

[algorithm SPEC-036](../algorithms/spec-036.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0207](../tickets/zn-0207.md) | Implement scenario branches and hypothetical data overlays | component | [ZN-0146](../tickets/zn-0146.md), [ZN-0178](../tickets/zn-0178.md), [ZN-0185](../tickets/zn-0185.md), [ZN-0200](../tickets/zn-0200.md), [ZN-0206](../tickets/zn-0206.md) |
| [ZN-0208](../tickets/zn-0208.md) | Compare scenarios with explicit basis and coverage | component | [ZN-0207](../tickets/zn-0207.md) |
| [ZN-0209](../tickets/zn-0209.md) | Create a fresh live Case from a hypothetical result | component | [ZN-0208](../tickets/zn-0208.md) |
| [ZN-0210](../tickets/zn-0210.md) | Implement notebook and training data-use admission | component | [ZN-0209](../tickets/zn-0209.md) |
| [ZN-0211](../tickets/zn-0211.md) | Register and evaluate versioned model artifacts | component | [ZN-0210](../tickets/zn-0210.md) |
| [ZN-0212](../tickets/zn-0212.md) | Prove point-in-time analysis and scenario isolation | journey | [ZN-0211](../tickets/zn-0211.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `models-retrieval-and-agents.md`, `data-flows-and-live-data.md`, `apps-charts-and-surfaces.md`. Read a named historical reference only when needed; it cannot override current contracts.
