# SPEC-042 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-042](../specs/spec-042.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Platform Kernel**. Module: `packages/ontology/src/cells`. Milestone: **S10**.

## Normative operation signatures

```text
PrepareMove(world,destination) -> StagedReplica; FenceSource(world,epoch) -> FenceReceipt; PromoteWorld(fence,destinationProof,expectedDirectory) -> NewEpoch; AdmitBoot(world,cell,epoch) -> WriteAdmission | ReadOnly.
```

## State and transaction contract

control.world_directory(world_id,realm PK,cell_id,epoch,region,state,version); control.promotions(promotion_id PK,world_id,source_epoch,target_epoch,source_fence_receipt,destination_proof,state); ontology.local_authority(world_id PK,installed_epoch,write_enabled,fence_receipt,boot_admission); jobs.migration_runs(run_id PK,world_id,source_cut,target_cut,validation_ref,state). Directory is a single-writer durable control store, not a grant database.

## Shared algorithm

```text
COPY World into fenced non-authoritative destination with exact release, data pins, rights and open-work inventory.
REPLAY complete source commits; compare expected cut and deterministic validation evidence.
ACQUIRE exclusive source head fence; stop new writes/permits and persist final fence receipt/cut.
REQUIRE source acknowledgement or approved infrastructure fencing that proves source cannot act; uncertainty blocks promotion.
CAS durable coordinator directory from expected source epoch to destination epoch.
INSTALL destination write admission for the new epoch, then permit routing; old boot/backup defaults fenced.
PRESERVE stable external effect identities and reconcile any escaped requests independently of cell ownership.
ON partial failure keep at most one admitted writer; do not sacrifice fencing to preserve availability.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0245](../tickets/zn-0245.md) | Implement content-free directory and boot admission | [packages/ontology/src/cells/cell-directory.ts](../../packages/ontology/src/cells/cell-directory.ts) |
| [ZN-0246](../tickets/zn-0246.md) | Stage destination copy and committed catch-up | [packages/ontology/src/cells/migration-stage.ts](../../packages/ontology/src/cells/migration-stage.ts) |
| [ZN-0247](../tickets/zn-0247.md) | Fence source and collect durable stop evidence | [packages/ontology/src/cells/source-fence.ts](../../packages/ontology/src/cells/source-fence.ts) |
| [ZN-0248](../tickets/zn-0248.md) | Promote epoch atomically and reject stale work | [packages/ontology/src/cells/epoch-promotion.ts](../../packages/ontology/src/cells/epoch-promotion.ts) |
| [ZN-0249](../tickets/zn-0249.md) | Prove partition, rollback and escaped-effect scenarios | [tests/chaos/spec-042/migration-chaos.test.ts](../../tests/chaos/spec-042/migration-chaos.test.ts) |

## Required proof boundaries

Copy into non-authoritative destination, replay complete commits, verify data/rights/pins/open work. Source exclusive head fence stops new writes/permits and records final cut. Require source fence acknowledgement; when unavailable, block promotion unless approved infrastructure fencing proves the source cannot act. CAS coordinator epoch, install destination admission, then route. Every boot defaults fenced until current coordinator admission; an old restored backup cannot start as writer. Stable effect IDs reconcile escaped requests.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
