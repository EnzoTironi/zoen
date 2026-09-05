# SPEC-020 — Semantic Watches, Notices and quiet attention

**Milestone:** S3 · **Owner:** Ontology and Eve · **Root:** `packages/ontology/src/attention`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Ontology decides whether a committed semantic change is material; Eve decides whether, when and how to interrupt. Raw ticks and arbitrary source row changes never directly wake the model. Deferred Notices contain references, not permanently authorized payloads.

## Owned state and storage contract
ontology.watches(watch_id PK,world_id,definition_digest,subject_scope,state,checkpoint_cut,materiality_state); ontology.notices(notice_id PK,watch_id,transition_identity,basis_ref,state,UNIQUE(watch_id,transition_identity)); eve.attention(notice_id,relationship_id PK,state,reason,not_before,merge_group,last_checked_rights); ontology.subscriptions(subscription_id PK,world_id,plan_digest,cursor,state).

## Operations

```text
CreateWatch(definition,scope,operationId) -> Watch; EvaluateWatch(watch,commitEnvelope) -> Checkpoint | Notice; DecideAttention(noticeRef,relationship) -> Deliver | Merge | Defer | Silence; PauseWatch/ResumeWatch/CancelWatch -> Receipt.
```

## Execution protocol
Consume complete commits with per-domain cursors. Maintain explicit stale-data transitions. Deduplicate by semantic transition identity, not a timestamp. A Notice is durable even if no message is sent. Before composition and delivery Eve fetches a freshly authorized Notice view. Revocation suppresses it; quiet hours and channel consent can defer it. Management views explain suppressions without revealing hidden changes.

V4 refinement: Mini-app subscriptions use the same released subscription operations and semantic Notice/Watch mechanisms as other clients. Reauthorize before every dispatch; revoked clients receive no data-bearing tombstone or hidden-object count.

V4 normative detail: [single semantic path](../architecture/semantic-path.md).

## Pseudocode and file ownership

[algorithm SPEC-020](../algorithms/spec-020.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0118](../tickets/zn-0118.md) | Implement runtime Watch definitions and lifecycle | component | [ZN-0105](../tickets/zn-0105.md), [ZN-0111](../tickets/zn-0111.md), [ZN-0117](../tickets/zn-0117.md) |
| [ZN-0119](../tickets/zn-0119.md) | Evaluate material changes and stale-data transitions | component | [ZN-0118](../tickets/zn-0118.md) |
| [ZN-0120](../tickets/zn-0120.md) | Implement Eve attention arbitration | component | [ZN-0119](../tickets/zn-0119.md) |
| [ZN-0121](../tickets/zn-0121.md) | Reauthorize deferred Notices before composition and send | component | [ZN-0120](../tickets/zn-0120.md) |
| [ZN-0122](../tickets/zn-0122.md) | Expose Watch inspector and subscription recovery | component | [ZN-0121](../tickets/zn-0121.md) |
| [ZN-0123](../tickets/zn-0123.md) | Prove quiet-attention journey under duplicate and delayed delivery | journey | [ZN-0122](../tickets/zn-0122.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `watches-mandates-and-outcomes.md`, `messaging-channels.md`. Read a named historical reference only when needed; it cannot override current contracts.
