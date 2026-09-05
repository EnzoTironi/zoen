# SPEC-032 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-032](../specs/spec-032.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Data Platform**. Module: `packages/ontology/src/flows`. Milestone: **S7**.

## Normative operation signatures

```text
RunFlow(definition,inputs) -> FlowRun; CheckpointPartition(run,partition,fence,cursor) -> Progress; EvaluateQuality(check,inputCoverage) -> pass|fail|unknown; ProposeFlowPublication(run) -> DatasetProposal | Blocked.
```

## State and transaction contract

ontology.flow_definitions are released data; jobs.flow_runs(run_id PK,world_id,definition_digest,input_cut,state,attempt,budget_ref); jobs.flow_partitions(run_id,partition PK,cursor,watermark,gaps_json,fence,state); ontology.lineage_edges(output_ref,input_ref,field_mapping_digest PK); ontology.quality_results(result_id PK,run_id,check_id,status,coverage,details_ref).

## Shared algorithm

```text
COMPILE released flow DAG with typed steps, scopes, budgets and explicit checkpoint/watermark semantics.
CAPTURE real source records with stable source identity before transformation/admission.
CHECK lease/fence and replay checkpoint; retries deduplicate work without suppressing genuine revisions.
EXECUTE bounded transformations over exact input versions with recorded lineage and rights.
COMMIT progress/checkpoint only after durable outputs and admitted transitions; partial batch stays explicit.
HANDLE late/out-of-order events, schema change, tombstones and gaps according to the released source contract.
PUBLISH only through evidence/dataset/authority protocols; a successful job is not a published business fact.
STOP/rebase incompatible definitions and revoked sources; no inferred deletion from temporary absence.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0186](../tickets/zn-0186.md) | Define released flow DAGs and bounded node types | [packages/ontology/src/flows/flow-dag.ts](../../packages/ontology/src/flows/flow-dag.ts) |
| [ZN-0187](../tickets/zn-0187.md) | Implement durable batch and incremental flow runs | [packages/ontology/src/flows/flow-runner.ts](../../packages/ontology/src/flows/flow-runner.ts) |
| [ZN-0188](../tickets/zn-0188.md) | Implement source-specific CDC checkpoint and gap behavior | [packages/ontology/src/flows/cdc.ts](../../packages/ontology/src/flows/cdc.ts) |
| [ZN-0189](../tickets/zn-0189.md) | Implement event-time watermarks and late corrections | [packages/ontology/src/flows/watermarks.ts](../../packages/ontology/src/flows/watermarks.ts) |
| [ZN-0190](../tickets/zn-0190.md) | Implement field-level lineage and tri-state quality gates | [packages/ontology/src/flows/quality-lineage.ts](../../packages/ontology/src/flows/quality-lineage.ts) |
| [ZN-0191](../tickets/zn-0191.md) | Prove enterprise revenue reconciliation through data flows | [tests/journey/spec-032/flow-journey.test.ts](../../tests/journey/spec-032/flow-journey.test.ts) |

## Required proof boundaries

Persist node intents and idempotent output identities. Consume batch/incremental/CDC with source-specific replay contracts; no universal exactly-once source promise. Late changes produce new versions and invalidation. Missing partitions prevent complete aggregate/negative assertions. Track field-level transform lineage including model/executable versions. Multi-node retries reuse captured immutable inputs where valid.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
