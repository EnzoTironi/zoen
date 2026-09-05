# SPEC-042 — Fenced cell migration and single-writer authority epochs

**Milestone:** S10 · **Owner:** Platform Kernel · **Root:** `packages/ontology/src/cells`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
A directory change alone is not fencing. Promotion requires durable proof that old authority can no longer accept writes/new effect attempts, or explicit independently verified infrastructure fencing. A partition sacrifices availability rather than creating two live writers.

## Owned state and storage contract
control.world_directory(world_id,realm PK,cell_id,epoch,region,state,version); control.promotions(promotion_id PK,world_id,source_epoch,target_epoch,source_fence_receipt,destination_proof,state); ontology.local_authority(world_id PK,installed_epoch,write_enabled,fence_receipt,boot_admission); jobs.migration_runs(run_id PK,world_id,source_cut,target_cut,validation_ref,state). Directory is a single-writer durable control store, not a grant database.

## Operations

```text
PrepareMove(world,destination) -> StagedReplica; FenceSource(world,epoch) -> FenceReceipt; PromoteWorld(fence,destinationProof,expectedDirectory) -> NewEpoch; AdmitBoot(world,cell,epoch) -> WriteAdmission | ReadOnly.
```

## Execution protocol
Copy into non-authoritative destination, replay complete commits, verify data/rights/pins/open work. Source exclusive head fence stops new writes/permits and records final cut. Require source fence acknowledgement; when unavailable, block promotion unless approved infrastructure fencing proves the source cannot act. CAS coordinator epoch, install destination admission, then route. Every boot defaults fenced until current coordinator admission; an old restored backup cannot start as writer. Stable effect IDs reconcile escaped requests.

## Pseudocode and file ownership

[algorithm SPEC-042](../algorithms/spec-042.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0245](../tickets/zn-0245.md) | Implement content-free directory and boot admission | component | [ZN-0229](../tickets/zn-0229.md), [ZN-0235](../tickets/zn-0235.md) |
| [ZN-0246](../tickets/zn-0246.md) | Stage destination copy and committed catch-up | component | [ZN-0245](../tickets/zn-0245.md) |
| [ZN-0247](../tickets/zn-0247.md) | Fence source and collect durable stop evidence | component | [ZN-0246](../tickets/zn-0246.md) |
| [ZN-0248](../tickets/zn-0248.md) | Promote epoch atomically and reject stale work | component | [ZN-0247](../tickets/zn-0247.md) |
| [ZN-0249](../tickets/zn-0249.md) | Prove partition, rollback and escaped-effect scenarios | chaos | [ZN-0248](../tickets/zn-0248.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `deployment-cells-and-federation.md`, `authority-concurrency-and-cuts.md`. Read a named historical reference only when needed; it cannot override current contracts.
