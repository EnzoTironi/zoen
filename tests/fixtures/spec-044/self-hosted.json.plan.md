# File plan — `tests/fixtures/spec-044/self-hosted.json`

**Status:** planned; no product acceptance implied.

Target: `tests/fixtures/spec-044/self-hosted.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-044](../../../docs/specs/spec-044.md).
Tickets: [ZN-0258](../../../docs/tickets/zn-0258.md).

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

### SPEC-044
IssueOfflineLease(scope,resourcePartition,expiry) -> ChildLease; RecordOfflineOperation(lease,intent) -> LocalReceipt | Denied; ReconcileChild(receipts) -> Admitted|Conflict|Expired; AdmitSelfHostedProfile(evidence) -> Profile; ProposeFleetUpdate(release) -> LocalChangeSet.

ontology.child_leases(lease_id PK,parent_world,child_scope,epoch,resource_partition,allowed_ops,expires_at,clock_uncertainty,max_offline,state); ontology.offline_receipts(receipt_id PK,child_scope,lease_ref,sequence,intent_digest,observed_basis,reconciled_state); control.fleet_profiles(profile_id PK,version,equivalence_evidence,policy_digest,state).

[algorithm SPEC-044](../../../docs/algorithms/spec-044.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
