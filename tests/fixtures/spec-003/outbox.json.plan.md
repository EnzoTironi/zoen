# File plan — `tests/fixtures/spec-003/outbox.json`

**Status:** planned; no product acceptance implied.

Target: `tests/fixtures/spec-003/outbox.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-003](../../../docs/specs/spec-003.md).
Tickets: [ZN-0023](../../../docs/tickets/zn-0023.md).

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

### SPEC-003
AuthorityCommit(context, expectedHead, guards, operationKey, typedPlan) -> Receipt | Stale | Conflict; ProgressCommit(leaseToken,progress) -> Progress | LostLease; ClaimOutbox(owner,limit) -> FencedBatch.

ontology.domains(world_id,domain_id PK,version bigint>=0); ontology.operations(world_id,principal_id,semantic_op,operation_id PK,intent_digest,result_ref,commit_id); ontology.commits(commit_id PK,world_id,head_digest,touched_domains jsonb,recorded_at); ontology.receipts(receipt_id PK,world_id,commit_id,kind,payload_digest,payload_json); jobs.outbox(outbox_id PK,owner,world_id,commit_id,event_ordinal,payload_ref,status,lease_owner,fence,lease_until,UNIQUE(owner,commit_id,event_ordinal)). All world references include realm and ownership checks.

[algorithm SPEC-003](../../../docs/algorithms/spec-003.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
