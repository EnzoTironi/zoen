# SPEC-031 — Dense Parquet/Iceberg datasets and atomic publication

**Milestone:** S7 · **Owner:** Data Platform · **Root:** `packages/ontology/src/datasets`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Use Parquet and the admitted Iceberg v2 profile, Lakekeeper REST catalog and bounded DuckDB workers. Ontology publishes exact immutable snapshot references. Catalog latest is never an authoritative or historical data basis. Dense data is installed only when this slice requires it.

## Owned state and storage contract
ontology.dataset_versions(version_id PK,world_id,dataset_id,table_uuid,snapshot_id,metadata_location,metadata_digest,schema_digest,partition_spec,input_cut,lineage_ref,rights_label,quality_ref); ontology.dataset_pins(pin_id PK,version_id,artifact_set_digest,retention_until,state); ontology.dataset_publications(publication_id PK,world_id,version_refs,commit_id); jobs.dataset_stages(stage_id PK,run_id,table_branch,version_ref,state). Catalog uses a separate database.

## Operations

```text
StageDataset(run,inputs) -> StagedVersion; ValidateDataset(stage) -> QualityResult; PinDataset(stage,retention) -> PinProof; PublishDataset(versionSet,expectedBasis,operationId) -> PublicationReceipt; ReadDataset(versionRef,grant) -> ExactSnapshotReader.
```

## Execution protocol
Write staged files and isolated snapshot; validate exact metadata/schema/rights/completeness; create physical retention pins; verify pins; publish the version set in one authority transaction; finalize catalog bookkeeping asynchronously. No cross-system ACID is claimed. Orphan staging is collectible only when no authoritative/pending pin references it. Unsupported Iceberg delete/timestamp features fail admission.

V4 refinement: Bulk snapshots reach clients only through a released authorized read/export/analysis operation. Internal Iceberg/S3/DuckDB ports remain inaccessible to apps. Opaque chunk/cursor references carry no authority and are rechecked on retrieval.

V4 normative detail: [single semantic path](../architecture/semantic-path.md).

## Pseudocode and file ownership

[algorithm SPEC-031](../algorithms/spec-031.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0180](../tickets/zn-0180.md) | Admit the exact catalog, writer and DuckDB reader profile | component | [ZN-0094](../tickets/zn-0094.md), [ZN-0117](../tickets/zn-0117.md), [ZN-0178](../tickets/zn-0178.md) |
| [ZN-0181](../tickets/zn-0181.md) | Write staged immutable dataset versions | component | [ZN-0180](../tickets/zn-0180.md) |
| [ZN-0182](../tickets/zn-0182.md) | Enforce physical pins before authority publication | component | [ZN-0181](../tickets/zn-0181.md) |
| [ZN-0183](../tickets/zn-0183.md) | Publish coherent snapshot sets in one local commit | component | [ZN-0182](../tickets/zn-0182.md) |
| [ZN-0184](../tickets/zn-0184.md) | Read exact snapshots with bounded analytics and rights | component | [ZN-0183](../tickets/zn-0183.md) |
| [ZN-0185](../tickets/zn-0185.md) | Prove publication, GC and erasure races on real components | chaos | [ZN-0184](../tickets/zn-0184.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `data-events-parquet.md`, `data-flows-and-live-data.md`. Read a named historical reference only when needed; it cannot override current contracts.
