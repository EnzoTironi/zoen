# SPEC-044 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-044](../specs/spec-044.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Platform Operations**. Module: `packages/ontology/src/edge`. Milestone: **S10**.

## Normative operation signatures

```text
IssueOfflineLease(scope,resourcePartition,expiry) -> ChildLease; RecordOfflineOperation(lease,intent) -> LocalReceipt | Denied; ReconcileChild(receipts) -> Admitted|Conflict|Expired; AdmitSelfHostedProfile(evidence) -> Profile; ProposeFleetUpdate(release) -> LocalChangeSet.
```

## State and transaction contract

ontology.child_leases(lease_id PK,parent_world,child_scope,epoch,resource_partition,allowed_ops,expires_at,clock_uncertainty,max_offline,state); ontology.offline_receipts(receipt_id PK,child_scope,lease_ref,sequence,intent_digest,observed_basis,reconciled_state); control.fleet_profiles(profile_id PK,version,equivalence_evidence,policy_digest,state).

## Shared algorithm

```text
REQUIRE a separately admitted child-World profile with bounded rights/resource partition, expiry and clock assumptions.
ISSUE lease through parent authority with explicit allowed operations and maximum disconnected horizon.
RUN the same admitted semantic implementation in the child; local app caches never become a second authority.
REJECT unpartitioned/nonreversible external effects by default; no queue of hidden provider writes awaiting reconnect.
RECORD ordered local receipts and observed basis under lease/fence with resource conservation.
ON reconnect submit receipts as evidence for reconciliation, not commands to replay blindly.
CLASSIFY admitted/conflict/expired results under current parent policy and source state.
QUALIFY self-hosted/fleet updates against the same laws; this future product feature is not a testing/service substitute.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0255](../tickets/zn-0255.md) | Issue distinct offline child authority leases | [packages/ontology/src/edge/offline-lease.ts](../../packages/ontology/src/edge/offline-lease.ts) |
| [ZN-0256](../tickets/zn-0256.md) | Record offline operations and enforce expiry | [packages/ontology/src/edge/offline-execution.ts](../../packages/ontology/src/edge/offline-execution.ts) |
| [ZN-0257](../tickets/zn-0257.md) | Reconcile child receipts without blind replay | [packages/ontology/src/edge/offline-reconcile.ts](../../packages/ontology/src/edge/offline-reconcile.ts) |
| [ZN-0258](../tickets/zn-0258.md) | Define and test self-hosted infrastructure equivalence | [packages/ontology/src/edge/self-hosted.ts](../../packages/ontology/src/edge/self-hosted.ts) |
| [ZN-0259](../tickets/zn-0259.md) | Implement fleet release and policy governance | [packages/ontology/src/edge/fleet-policy.ts](../../packages/ontology/src/edge/fleet-policy.ts) |
| [ZN-0260](../tickets/zn-0260.md) | Qualify edge, self-hosted and fleet operating profiles | [admissions/spec-044/edge-profile-admission.json](../../admissions/spec-044/edge-profile-admission.json.plan.md) |

## Required proof boundaries

Offline operations need explicit bounded rights and trustworthy expiry/clock assumptions. Non-reversible external actions default denied unless resources/authority were partitioned beforehand. On reconnect, receipts are evidence for reconciliation, not commands to blindly replay. Fleet rollback is a proved prepared transition; no remote publisher may override local authority or residency.

V4 refinement: Offline execution is the same admitted semantic implementation and bounded grammar inside a distinct leased child World. Do not use disconnected mini-app caches as a second offline authority or silently queue external provider writes.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
