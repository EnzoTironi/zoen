# File plan — `runbooks/spec-031/dataset-read.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-031/dataset-read.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-031](../../docs/specs/spec-031.md).
Tickets: [ZN-0184](../../docs/tickets/zn-0184.md).

## Responsibility and reuse

## ZN-0184 operational/repair procedure

Scope: Read exact snapshots with bounded analytics and rights. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
The historical query executes
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
READ exact input versions and current source/license rights; allocate a non-authoritative staging run.
WRITE immutable Parquet/Iceberg data and catalog metadata under admitted schema/profile with deterministic run identity.
VALIDATE schema, counts/quality, lineage, exact snapshot and retention pins before readiness.
RECHECK expected authority basis and publication policy; staging/catalog latest is never public authority.
ATOMically publish a DatasetVersion reference and receipt in Ontology; readers resolve only published exact versions.
EXECUTE dense reads outside long SQL transactions using pinned snapshots and bounded resources.
REAUTHORIZE chunk delivery and derived output labels; fail when a pinned version is unavailable.
GARbage-collect only after active publication, frame, evaluation, legal hold and retention references allow deletion.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
It reads the exact pinned snapshot or returns unavailable, never silently the new catalog head
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-031
StageDataset(run,inputs) -> StagedVersion; ValidateDataset(stage) -> QualityResult; PinDataset(stage,retention) -> PinProof; PublishDataset(versionSet,expectedBasis,operationId) -> PublicationReceipt; ReadDataset(versionRef,grant) -> ExactSnapshotReader.

ontology.dataset_versions(version_id PK,world_id,dataset_id,table_uuid,snapshot_id,metadata_location,metadata_digest,schema_digest,partition_spec,input_cut,lineage_ref,rights_label,quality_ref); ontology.dataset_pins(pin_id PK,version_id,artifact_set_digest,retention_until,state); ontology.dataset_publications(publication_id PK,world_id,version_refs,commit_id); jobs.dataset_stages(stage_id PK,run_id,table_branch,version_ref,state). Catalog uses a separate database.

[algorithm SPEC-031](../../docs/algorithms/spec-031.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
