# File plan — `runbooks/spec-032/watermarks.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-032/watermarks.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-032](../../docs/specs/spec-032.md).
Tickets: [ZN-0189](../../docs/tickets/zn-0189.md).

## Responsibility and reuse

## ZN-0189 operational/repair procedure

Scope: Implement event-time watermarks and late corrections. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
The event arrives
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
COMPILE released flow DAG with typed steps, scopes, budgets and explicit checkpoint/watermark semantics.
CAPTURE real source records with stable source identity before transformation/admission.
CHECK lease/fence and replay checkpoint; retries deduplicate work without suppressing genuine revisions.
EXECUTE bounded transformations over exact input versions with recorded lineage and rights.
COMMIT progress/checkpoint only after durable outputs and admitted transitions; partial batch stays explicit.
HANDLE late/out-of-order events, schema change, tombstones and gaps according to the released source contract.
PUBLISH only through evidence/dataset/authority protocols; a successful job is not a published business fact.
STOP/rebase incompatible definitions and revoked sources; no inferred deletion from temporary absence.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
The old snapshot remains immutable; a new version corrects the period and dependent decisions become stale as required
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-032
RunFlow(definition,inputs) -> FlowRun; CheckpointPartition(run,partition,fence,cursor) -> Progress; EvaluateQuality(check,inputCoverage) -> pass|fail|unknown; ProposeFlowPublication(run) -> DatasetProposal | Blocked.

ontology.flow_definitions are released data; jobs.flow_runs(run_id PK,world_id,definition_digest,input_cut,state,attempt,budget_ref); jobs.flow_partitions(run_id,partition PK,cursor,watermark,gaps_json,fence,state); ontology.lineage_edges(output_ref,input_ref,field_mapping_digest PK); ontology.quality_results(result_id PK,run_id,check_id,status,coverage,details_ref).

[algorithm SPEC-032](../../docs/algorithms/spec-032.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
