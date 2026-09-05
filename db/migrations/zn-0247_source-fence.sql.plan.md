# File plan — `db/migrations/zn-0247_source-fence.sql`

**Status:** planned; no product acceptance implied.

Target: `db/migrations/zn-0247_source-fence.sql`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-042](../../docs/specs/spec-042.md).
Tickets: [ZN-0247](../../docs/tickets/zn-0247.md).

## Responsibility and reuse

```text
CONDITIONAL MIGRATION PLAN — never feed this Markdown to a migrator.
IF no durable invariant is introduced by the owning ticket: do not create a no-op SQL migration.
OTHERWISE acquire the global schema lock; inspect existing catalog and table owner before adding DDL.
DECLARE explicit types, primary/unique keys, World+realm composite foreign references and indexes.
SEPARATE migrator DDL from runtime roles; parameterize values and retain source/rights/retention lineage.
ORDER expand → backfill → validate → contract, with restartable bounded backfill.
TEST empty database, prior-schema upgrade, role denials, crash boundary and forward repair using real PostgreSQL.
ASSIGN final monotonic migration number only when the genuine SQL is reviewed; never pre-record a planned migration as applied.
```

## Owning state / operation contracts

### SPEC-042
PrepareMove(world,destination) -> StagedReplica; FenceSource(world,epoch) -> FenceReceipt; PromoteWorld(fence,destinationProof,expectedDirectory) -> NewEpoch; AdmitBoot(world,cell,epoch) -> WriteAdmission | ReadOnly.

control.world_directory(world_id,realm PK,cell_id,epoch,region,state,version); control.promotions(promotion_id PK,world_id,source_epoch,target_epoch,source_fence_receipt,destination_proof,state); ontology.local_authority(world_id PK,installed_epoch,write_enabled,fence_receipt,boot_admission); jobs.migration_runs(run_id PK,world_id,source_cut,target_cut,validation_ref,state). Directory is a single-writer durable control store, not a grant database.

[algorithm SPEC-042](../../docs/algorithms/spec-042.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
