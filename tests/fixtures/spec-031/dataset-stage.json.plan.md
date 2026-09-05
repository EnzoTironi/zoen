# File plan — `tests/fixtures/spec-031/dataset-stage.json`

**Status:** planned; no product acceptance implied.

Target: `tests/fixtures/spec-031/dataset-stage.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-031](../../../docs/specs/spec-031.md).
Tickets: [ZN-0181](../../../docs/tickets/zn-0181.md).

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

### SPEC-031
StageDataset(run,inputs) -> StagedVersion; ValidateDataset(stage) -> QualityResult; PinDataset(stage,retention) -> PinProof; PublishDataset(versionSet,expectedBasis,operationId) -> PublicationReceipt; ReadDataset(versionRef,grant) -> ExactSnapshotReader.

ontology.dataset_versions(version_id PK,world_id,dataset_id,table_uuid,snapshot_id,metadata_location,metadata_digest,schema_digest,partition_spec,input_cut,lineage_ref,rights_label,quality_ref); ontology.dataset_pins(pin_id PK,version_id,artifact_set_digest,retention_until,state); ontology.dataset_publications(publication_id PK,world_id,version_refs,commit_id); jobs.dataset_stages(stage_id PK,run_id,table_branch,version_ref,state). Catalog uses a separate database.

[algorithm SPEC-031](../../../docs/algorithms/spec-031.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
