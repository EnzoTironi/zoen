# File plan — `runbooks/spec-020/attention-policy.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-020/attention-policy.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-020](../../docs/specs/spec-020.md).
Tickets: [ZN-0120](../../docs/tickets/zn-0120.md).

## Responsibility and reuse

## ZN-0120 operational/repair procedure

Scope: Implement Eve attention arbitration. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
Eve arbitrates
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
CREATE/Edit/Pause/Resume/Cancel Watch through ordinary governed operations with stable identity.
CONSUME complete commits using per-domain cursors; evaluate only released semantic materiality, not every raw tick.
ADVANCE checkpoint when unchanged; represent stale-data transitions explicitly.
ATOMically create one Notice and outbox for a new semantic transition; duplicate evaluation cannot notify twice.
EVE receives opaque Notice reference and freshly authorizes its view before composition.
APPLY relationship attention policy: silence, merge, defer or deliver with quiet hours and consent.
REAUTHORIZE after deferral and before every stream/delivery flush; revocation yields no hidden tombstone.
EXPLAIN authorized suppression and pending work; lack of a message is not loss of the durable Notice.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
It can defer/merge into one permitted message without losing the three source Notice references or inventing urgency
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-020
CreateWatch(definition,scope,operationId) -> Watch; EvaluateWatch(watch,commitEnvelope) -> Checkpoint | Notice; DecideAttention(noticeRef,relationship) -> Deliver | Merge | Defer | Silence; PauseWatch/ResumeWatch/CancelWatch -> Receipt.

ontology.watches(watch_id PK,world_id,definition_digest,subject_scope,state,checkpoint_cut,materiality_state); ontology.notices(notice_id PK,watch_id,transition_identity,basis_ref,state,UNIQUE(watch_id,transition_identity)); eve.attention(notice_id,relationship_id PK,state,reason,not_before,merge_group,last_checked_rights); ontology.subscriptions(subscription_id PK,world_id,plan_digest,cursor,state).

[algorithm SPEC-020](../../docs/algorithms/spec-020.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
