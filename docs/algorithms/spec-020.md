# SPEC-020 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-020](../specs/spec-020.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Ontology and Eve**. Module: `packages/ontology/src/attention`. Milestone: **S3**.

## Normative operation signatures

```text
CreateWatch(definition,scope,operationId) -> Watch; EvaluateWatch(watch,commitEnvelope) -> Checkpoint | Notice; DecideAttention(noticeRef,relationship) -> Deliver | Merge | Defer | Silence; PauseWatch/ResumeWatch/CancelWatch -> Receipt.
```

## State and transaction contract

ontology.watches(watch_id PK,world_id,definition_digest,subject_scope,state,checkpoint_cut,materiality_state); ontology.notices(notice_id PK,watch_id,transition_identity,basis_ref,state,UNIQUE(watch_id,transition_identity)); eve.attention(notice_id,relationship_id PK,state,reason,not_before,merge_group,last_checked_rights); ontology.subscriptions(subscription_id PK,world_id,plan_digest,cursor,state).

## Shared algorithm

```text
CREATE/Edit/Pause/Resume/Cancel Watch through ordinary governed operations with stable identity.
CONSUME complete commits using per-domain cursors; evaluate only released semantic materiality, not every raw tick.
ADVANCE checkpoint when unchanged; represent stale-data transitions explicitly.
ATOMically create one Notice and outbox for a new semantic transition; duplicate evaluation cannot notify twice.
EVE receives opaque Notice reference and freshly authorizes its view before composition.
APPLY relationship attention policy: silence, merge, defer or deliver with quiet hours and consent.
REAUTHORIZE after deferral and before every stream/delivery flush; revocation yields no hidden tombstone.
EXPLAIN authorized suppression and pending work; lack of a message is not loss of the durable Notice.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0118](../tickets/zn-0118.md) | Implement runtime Watch definitions and lifecycle | [packages/ontology/src/attention/watch-contract.ts](../../packages/ontology/src/attention/watch-contract.ts) |
| [ZN-0119](../tickets/zn-0119.md) | Evaluate material changes and stale-data transitions | [packages/ontology/src/attention/watch-evaluator.ts](../../packages/ontology/src/attention/watch-evaluator.ts) |
| [ZN-0120](../tickets/zn-0120.md) | Implement Eve attention arbitration | [packages/ontology/src/attention/attention-policy.ts](../../packages/ontology/src/attention/attention-policy.ts) |
| [ZN-0121](../tickets/zn-0121.md) | Reauthorize deferred Notices before composition and send | [packages/ontology/src/attention/notice-disclosure.ts](../../packages/ontology/src/attention/notice-disclosure.ts) |
| [ZN-0122](../tickets/zn-0122.md) | Expose Watch inspector and subscription recovery | [packages/ontology/src/attention/watch-inspector.ts](../../packages/ontology/src/attention/watch-inspector.ts) |
| [ZN-0123](../tickets/zn-0123.md) | Prove quiet-attention journey under duplicate and delayed delivery | [tests/journey/spec-020/attention-journey.test.ts](../../tests/journey/spec-020/attention-journey.test.ts) |

## Required proof boundaries

Consume complete commits with per-domain cursors. Maintain explicit stale-data transitions. Deduplicate by semantic transition identity, not a timestamp. A Notice is durable even if no message is sent. Before composition and delivery Eve fetches a freshly authorized Notice view. Revocation suppresses it; quiet hours and channel consent can defer it. Management views explain suppressions without revealing hidden changes.

V4 refinement: Mini-app subscriptions use the same released subscription operations and semantic Notice/Watch mechanisms as other clients. Reauthorize before every dispatch; revoked clients receive no data-bearing tombstone or hidden-object count.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
