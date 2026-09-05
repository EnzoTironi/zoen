# File plan — `runbooks/spec-044/edge-profile-admission.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-044/edge-profile-admission.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-044](../../docs/specs/spec-044.md).
Tickets: [ZN-0260](../../docs/tickets/zn-0260.md).

## Responsibility and reuse

## ZN-0260 operational/repair procedure

Scope: Qualify edge, self-hosted and fleet operating profiles. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
Both are advertised as supported
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
REQUIRE a separately admitted child-World profile with bounded rights/resource partition, expiry and clock assumptions.
ISSUE lease through parent authority with explicit allowed operations and maximum disconnected horizon.
RUN the same admitted semantic implementation in the child; local app caches never become a second authority.
REJECT unpartitioned/nonreversible external effects by default; no queue of hidden provider writes awaiting reconnect.
RECORD ordered local receipts and observed basis under lease/fence with resource conservation.
ON reconnect submit receipts as evidence for reconciliation, not commands to replay blindly.
CLASSIFY admitted/conflict/expired results under current parent policy and source state.
QUALIFY self-hosted/fleet updates against the same laws; this future product feature is not a testing/service substitute.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
Only the tested profile can be admitted; equivalent API shape is insufficient evidence
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-044
IssueOfflineLease(scope,resourcePartition,expiry) -> ChildLease; RecordOfflineOperation(lease,intent) -> LocalReceipt | Denied; ReconcileChild(receipts) -> Admitted|Conflict|Expired; AdmitSelfHostedProfile(evidence) -> Profile; ProposeFleetUpdate(release) -> LocalChangeSet.

ontology.child_leases(lease_id PK,parent_world,child_scope,epoch,resource_partition,allowed_ops,expires_at,clock_uncertainty,max_offline,state); ontology.offline_receipts(receipt_id PK,child_scope,lease_ref,sequence,intent_digest,observed_basis,reconciled_state); control.fleet_profiles(profile_id PK,version,equivalence_evidence,policy_digest,state).

[algorithm SPEC-044](../../docs/algorithms/spec-044.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
