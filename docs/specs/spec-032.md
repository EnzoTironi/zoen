# SPEC-032 — Governed batch, incremental, CDC and stream data flows

**Milestone:** S7 · **Owner:** Data Platform · **Root:** `packages/ontology/src/flows`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
A FlowDefinition is a bounded released DAG with source, transform, quality and publish nodes. It produces proposed captures/datasets, not direct authority writes. Watermarks, gaps, late events and schema evolution remain visible; unknown quality is not passing quality.

## Owned state and storage contract
ontology.flow_definitions are released data; jobs.flow_runs(run_id PK,world_id,definition_digest,input_cut,state,attempt,budget_ref); jobs.flow_partitions(run_id,partition PK,cursor,watermark,gaps_json,fence,state); ontology.lineage_edges(output_ref,input_ref,field_mapping_digest PK); ontology.quality_results(result_id PK,run_id,check_id,status,coverage,details_ref).

## Operations

```text
RunFlow(definition,inputs) -> FlowRun; CheckpointPartition(run,partition,fence,cursor) -> Progress; EvaluateQuality(check,inputCoverage) -> pass|fail|unknown; ProposeFlowPublication(run) -> DatasetProposal | Blocked.
```

## Execution protocol
Persist node intents and idempotent output identities. Consume batch/incremental/CDC with source-specific replay contracts; no universal exactly-once source promise. Late changes produce new versions and invalidation. Missing partitions prevent complete aggregate/negative assertions. Track field-level transform lineage including model/executable versions. Multi-node retries reuse captured immutable inputs where valid.

## Pseudocode and file ownership

[algorithm SPEC-032](../algorithms/spec-032.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0186](../tickets/zn-0186.md) | Define released flow DAGs and bounded node types | component | [ZN-0094](../tickets/zn-0094.md), [ZN-0123](../tickets/zn-0123.md), [ZN-0185](../tickets/zn-0185.md) |
| [ZN-0187](../tickets/zn-0187.md) | Implement durable batch and incremental flow runs | component | [ZN-0186](../tickets/zn-0186.md) |
| [ZN-0188](../tickets/zn-0188.md) | Implement source-specific CDC checkpoint and gap behavior | component | [ZN-0187](../tickets/zn-0187.md) |
| [ZN-0189](../tickets/zn-0189.md) | Implement event-time watermarks and late corrections | component | [ZN-0188](../tickets/zn-0188.md) |
| [ZN-0190](../tickets/zn-0190.md) | Implement field-level lineage and tri-state quality gates | component | [ZN-0189](../tickets/zn-0189.md) |
| [ZN-0191](../tickets/zn-0191.md) | Prove enterprise revenue reconciliation through data flows | journey | [ZN-0190](../tickets/zn-0190.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `data-flows-and-live-data.md`, `connectors-and-ingestion.md`. Read a named historical reference only when needed; it cannot override current contracts.
