// @zoen-plan packages/ontology/src/datasets/types.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/datasets/types.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/datasets/types.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-031](../../../../docs/specs/spec-031.md).
// Tickets: [ZN-0180](../../../../docs/tickets/zn-0180.md), [ZN-0181](../../../../docs/tickets/zn-0181.md), [ZN-0182](../../../../docs/tickets/zn-0182.md), [ZN-0183](../../../../docs/tickets/zn-0183.md), [ZN-0184](../../../../docs/tickets/zn-0184.md).
//
// ## Responsibility and reuse
//
// ```text
// CONTRACT SURFACE PLAN.
// DEFINE only the owning module's input/output/error/state and dependency-port types.
// REUSE branded kernel values, verified context, common semantic envelope and typed results.
// DO NOT export repositories or broad credentials to clients; authority context is server verified.
// SEPARATE versioned semantic meaning from transport metadata and immutable artifacts from mutable runtime state.
// VERIFY consumers use the same contracts and exhaustive tagged outcomes; unsupported shapes fail closed.
// ```
//
// ## Owning state / operation contracts
//
// ### SPEC-031
// StageDataset(run,inputs) -> StagedVersion; ValidateDataset(stage) -> QualityResult; PinDataset(stage,retention) -> PinProof; PublishDataset(versionSet,expectedBasis,operationId) -> PublicationReceipt; ReadDataset(versionRef,grant) -> ExactSnapshotReader.
//
// ontology.dataset_versions(version_id PK,world_id,dataset_id,table_uuid,snapshot_id,metadata_location,metadata_digest,schema_digest,partition_spec,input_cut,lineage_ref,rights_label,quality_ref); ontology.dataset_pins(pin_id PK,version_id,artifact_set_digest,retention_until,state); ontology.dataset_publications(publication_id PK,world_id,version_refs,commit_id); jobs.dataset_stages(stage_id PK,run_id,table_branch,version_ref,state). Catalog uses a separate database.
//
// [algorithm SPEC-031](../../../../docs/algorithms/spec-031.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
