# SPEC-031 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-031](../specs/spec-031.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Data Platform**. Module: `packages/ontology/src/datasets`. Milestone: **S7**.

## Normative operation signatures

```text
StageDataset(run,inputs) -> StagedVersion; ValidateDataset(stage) -> QualityResult; PinDataset(stage,retention) -> PinProof; PublishDataset(versionSet,expectedBasis,operationId) -> PublicationReceipt; ReadDataset(versionRef,grant) -> ExactSnapshotReader.
```

## State and transaction contract

ontology.dataset_versions(version_id PK,world_id,dataset_id,table_uuid,snapshot_id,metadata_location,metadata_digest,schema_digest,partition_spec,input_cut,lineage_ref,rights_label,quality_ref); ontology.dataset_pins(pin_id PK,version_id,artifact_set_digest,retention_until,state); ontology.dataset_publications(publication_id PK,world_id,version_refs,commit_id); jobs.dataset_stages(stage_id PK,run_id,table_branch,version_ref,state). Catalog uses a separate database.

## Shared algorithm

```text
READ exact input versions and current source/license rights; allocate a non-authoritative staging run.
WRITE immutable Parquet/Iceberg data and catalog metadata under admitted schema/profile with deterministic run identity.
VALIDATE schema, counts/quality, lineage, exact snapshot and retention pins before readiness.
RECHECK expected authority basis and publication policy; staging/catalog latest is never public authority.
ATOMically publish a DatasetVersion reference and receipt in Ontology; readers resolve only published exact versions.
EXECUTE dense reads outside long SQL transactions using pinned snapshots and bounded resources.
REAUTHORIZE chunk delivery and derived output labels; fail when a pinned version is unavailable.
GARbage-collect only after active publication, frame, evaluation, legal hold and retention references allow deletion.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0180](../tickets/zn-0180.md) | Admit the exact catalog, writer and DuckDB reader profile | [packages/ontology/src/datasets/dense-profile.ts](../../packages/ontology/src/datasets/dense-profile.ts) |
| [ZN-0181](../tickets/zn-0181.md) | Write staged immutable dataset versions | [packages/ontology/src/datasets/dataset-stage.ts](../../packages/ontology/src/datasets/dataset-stage.ts) |
| [ZN-0182](../tickets/zn-0182.md) | Enforce physical pins before authority publication | [packages/ontology/src/datasets/dataset-pins.ts](../../packages/ontology/src/datasets/dataset-pins.ts) |
| [ZN-0183](../tickets/zn-0183.md) | Publish coherent snapshot sets in one local commit | [packages/ontology/src/datasets/dataset-publish.ts](../../packages/ontology/src/datasets/dataset-publish.ts) |
| [ZN-0184](../tickets/zn-0184.md) | Read exact snapshots with bounded analytics and rights | [packages/ontology/src/datasets/dataset-read.ts](../../packages/ontology/src/datasets/dataset-read.ts) |
| [ZN-0185](../tickets/zn-0185.md) | Prove publication, GC and erasure races on real components | [tests/chaos/spec-031/dataset-chaos.test.ts](../../tests/chaos/spec-031/dataset-chaos.test.ts) |

## Required proof boundaries

Write staged files and isolated snapshot; validate exact metadata/schema/rights/completeness; create physical retention pins; verify pins; publish the version set in one authority transaction; finalize catalog bookkeeping asynchronously. No cross-system ACID is claimed. Orphan staging is collectible only when no authoritative/pending pin references it. Unsupported Iceberg delete/timestamp features fail admission.

V4 refinement: Bulk snapshots reach clients only through a released authorized read/export/analysis operation. Internal Iceberg/S3/DuckDB ports remain inaccessible to apps. Opaque chunk/cursor references carry no authority and are rechecked on retrieval.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
