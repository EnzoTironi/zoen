# File plan — `tests/fixtures/spec-020/watch-evaluator.json`

**Status:** planned; no product acceptance implied.

Target: `tests/fixtures/spec-020/watch-evaluator.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-020](../../../docs/specs/spec-020.md).
Tickets: [ZN-0119](../../../docs/tickets/zn-0119.md).

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

### SPEC-020
CreateWatch(definition,scope,operationId) -> Watch; EvaluateWatch(watch,commitEnvelope) -> Checkpoint | Notice; DecideAttention(noticeRef,relationship) -> Deliver | Merge | Defer | Silence; PauseWatch/ResumeWatch/CancelWatch -> Receipt.

ontology.watches(watch_id PK,world_id,definition_digest,subject_scope,state,checkpoint_cut,materiality_state); ontology.notices(notice_id PK,watch_id,transition_identity,basis_ref,state,UNIQUE(watch_id,transition_identity)); eve.attention(notice_id,relationship_id PK,state,reason,not_before,merge_group,last_checked_rights); ontology.subscriptions(subscription_id PK,world_id,plan_digest,cursor,state).

[algorithm SPEC-020](../../../docs/algorithms/spec-020.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
