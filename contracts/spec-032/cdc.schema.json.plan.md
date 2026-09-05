# File plan — `contracts/spec-032/cdc.schema.json`

**Status:** planned; no product acceptance implied.

Target: `contracts/spec-032/cdc.schema.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-032](../../docs/specs/spec-032.md).
Tickets: [ZN-0188](../../docs/tickets/zn-0188.md).

## Responsibility and reuse

```text
CONDITIONAL SCHEMA PLAN — no permissive {} schema or fabricated generated types.
RESOLVE exact input/output/tagged-error fields from the operation signatures and common protocol.
REQUIRE bounded sizes/depth/arrays, exact discriminants, validated IDs and explicit optional/null distinctions.
REJECT additional or authority-bearing client fields; money/counters stay strings where required.
GENERATE canonical fixtures, wire types and surface descriptors from this single reviewed schema source.
TEST malformed/oversized/unknown-version inputs and exact round trips; registry presence alone is not a pass.
```

## Owning state / operation contracts

### SPEC-032
RunFlow(definition,inputs) -> FlowRun; CheckpointPartition(run,partition,fence,cursor) -> Progress; EvaluateQuality(check,inputCoverage) -> pass|fail|unknown; ProposeFlowPublication(run) -> DatasetProposal | Blocked.

ontology.flow_definitions are released data; jobs.flow_runs(run_id PK,world_id,definition_digest,input_cut,state,attempt,budget_ref); jobs.flow_partitions(run_id,partition PK,cursor,watermark,gaps_json,fence,state); ontology.lineage_edges(output_ref,input_ref,field_mapping_digest PK); ontology.quality_results(result_id PK,run_id,check_id,status,coverage,details_ref).

[algorithm SPEC-032](../../docs/algorithms/spec-032.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
