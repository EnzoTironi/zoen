# File plan — `runbooks/spec-042/epoch-promotion.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-042/epoch-promotion.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-042](../../docs/specs/spec-042.md).
Tickets: [ZN-0248](../../docs/tickets/zn-0248.md).

## Responsibility and reuse

## ZN-0248 operational/repair procedure

Scope: Promote epoch atomically and reject stale work. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
Both request activation
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
COPY World into fenced non-authoritative destination with exact release, data pins, rights and open-work inventory.
REPLAY complete source commits; compare expected cut and deterministic validation evidence.
ACQUIRE exclusive source head fence; stop new writes/permits and persist final fence receipt/cut.
REQUIRE source acknowledgement or approved infrastructure fencing that proves source cannot act; uncertainty blocks promotion.
CAS durable coordinator directory from expected source epoch to destination epoch.
INSTALL destination write admission for the new epoch, then permit routing; old boot/backup defaults fenced.
PRESERVE stable external effect identities and reconcile any escaped requests independently of cell ownership.
ON partial failure keep at most one admitted writer; do not sacrifice fencing to preserve availability.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
Only one wins; all old-epoch writes/permits fail and no global superuser bypass exists
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-042
PrepareMove(world,destination) -> StagedReplica; FenceSource(world,epoch) -> FenceReceipt; PromoteWorld(fence,destinationProof,expectedDirectory) -> NewEpoch; AdmitBoot(world,cell,epoch) -> WriteAdmission | ReadOnly.

control.world_directory(world_id,realm PK,cell_id,epoch,region,state,version); control.promotions(promotion_id PK,world_id,source_epoch,target_epoch,source_fence_receipt,destination_proof,state); ontology.local_authority(world_id PK,installed_epoch,write_enabled,fence_receipt,boot_admission); jobs.migration_runs(run_id PK,world_id,source_cut,target_cut,validation_ref,state). Directory is a single-writer durable control store, not a grant database.

[algorithm SPEC-042](../../docs/algorithms/spec-042.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
