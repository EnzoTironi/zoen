# File plan — `runbooks/spec-036/scenario-store.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-036/scenario-store.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-036](../../docs/specs/spec-036.md).
Tickets: [ZN-0207](../../docs/tickets/zn-0207.md).

## Responsibility and reuse

## ZN-0207 operational/repair procedure

Scope: Implement scenario branches and hypothetical data overlays. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
The scenario executes
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
REOPEN exact authorized input Frames/datasets and record model/code/environment/seed provenance.
CREATE scenario overlay in isolated read-only analytical state; hypothetical values remain labeled assumptions.
RUN only admitted pure/isolated analysis with bounded resources and allowed model/data-use rights.
RECORD output uncertainty, scope, lineage and validity; model prediction is not an observed fact.
COMPARE scenario against its pinned baseline without mutating the live World.
FOR apply: reopen fresh live authority and form a new ActionCase with current guards/approval.
REJECT scenario tokens as live grants; do not carry stale consent from simulation to execution.
EVALUATE model changes through artifacts/releases with data leakage checks and measured rather than asserted performance.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
Live inventory/commitments remain unchanged and no provider request can escape
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-036
CreateScenario(base,assumptions) -> Scenario; RunScenario(scenario,analysis) -> HypotheticalResult; CompareScenarios(ids,metric) -> ComparisonFrame; ProposeFromScenario(resultRef,currentGrant) -> FreshLiveCase; AdmitModelArtifact(manifest,eval) -> CandidateModel.

ontology.scenarios(scenario_id PK,world_id,base_cut,assumptions_ref,analysis_refs,state,rights_label); ontology.model_artifacts(model_digest PK,training_manifest,code_digest,evaluation_ref,rights_label,retention_policy,admission_state); ontology.scenario_comparisons(comparison_id PK,scenario_refs,metric_definition,coverage,output_ref).

[algorithm SPEC-036](../../docs/algorithms/spec-036.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
