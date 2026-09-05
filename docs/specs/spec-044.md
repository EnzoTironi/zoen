# SPEC-044 — Offline child scopes, self-hosted equivalence and fleet policy

**Milestone:** S10 · **Owner:** Platform Operations · **Root:** `packages/ontology/src/edge`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Offline is a distinct leased child scope, not a second disconnected writer for the parent World. Self-hosted claims require tested equivalents for every security/storage/recovery contract. Fleet updates remain signed, evaluated and locally governed.

## Owned state and storage contract
ontology.child_leases(lease_id PK,parent_world,child_scope,epoch,resource_partition,allowed_ops,expires_at,clock_uncertainty,max_offline,state); ontology.offline_receipts(receipt_id PK,child_scope,lease_ref,sequence,intent_digest,observed_basis,reconciled_state); control.fleet_profiles(profile_id PK,version,equivalence_evidence,policy_digest,state).

## Operations

```text
IssueOfflineLease(scope,resourcePartition,expiry) -> ChildLease; RecordOfflineOperation(lease,intent) -> LocalReceipt | Denied; ReconcileChild(receipts) -> Admitted|Conflict|Expired; AdmitSelfHostedProfile(evidence) -> Profile; ProposeFleetUpdate(release) -> LocalChangeSet.
```

## Execution protocol
Offline operations need explicit bounded rights and trustworthy expiry/clock assumptions. Non-reversible external actions default denied unless resources/authority were partitioned beforehand. On reconnect, receipts are evidence for reconciliation, not commands to blindly replay. Fleet rollback is a proved prepared transition; no remote publisher may override local authority or residency.

V4 refinement: Offline execution is the same admitted semantic implementation and bounded grammar inside a distinct leased child World. Do not use disconnected mini-app caches as a second offline authority or silently queue external provider writes.

V4 normative detail: [single semantic path](../architecture/semantic-path.md).

## Pseudocode and file ownership

[algorithm SPEC-044](../algorithms/spec-044.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0255](../tickets/zn-0255.md) | Issue distinct offline child authority leases | component | [ZN-0218](../tickets/zn-0218.md), [ZN-0249](../tickets/zn-0249.md), [ZN-0254](../tickets/zn-0254.md) |
| [ZN-0256](../tickets/zn-0256.md) | Record offline operations and enforce expiry | component | [ZN-0255](../tickets/zn-0255.md) |
| [ZN-0257](../tickets/zn-0257.md) | Reconcile child receipts without blind replay | component | [ZN-0256](../tickets/zn-0256.md) |
| [ZN-0258](../tickets/zn-0258.md) | Define and test self-hosted infrastructure equivalence | component | [ZN-0257](../tickets/zn-0257.md) |
| [ZN-0259](../tickets/zn-0259.md) | Implement fleet release and policy governance | component | [ZN-0258](../tickets/zn-0258.md) |
| [ZN-0260](../tickets/zn-0260.md) | Qualify edge, self-hosted and fleet operating profiles | admission | [ZN-0259](../tickets/zn-0259.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `deployment-cells-and-federation.md`, `programmable-compute-and-skills.md`. Read a named historical reference only when needed; it cannot override current contracts.
