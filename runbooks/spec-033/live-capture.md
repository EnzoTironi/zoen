# File plan — `runbooks/spec-033/live-capture.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-033/live-capture.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-033](../../docs/specs/spec-033.md).
Tickets: [ZN-0194](../../docs/tickets/zn-0194.md).

## Responsibility and reuse

## ZN-0194 operational/repair procedure

Scope: Capture exact live values before consequential use. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
The user authorizes an order basis
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
VERIFY source entitlement, stream identity, sequence/clock/watermark and observed schema.
KEEP transient live plane separate from World authority; annotate gaps, duplicates, stale data and reconnect state.
SERVE subscriptions through released semantic operations with current policy and bounded backpressure.
DROP/coalesce only under declared display semantics; never quietly manufacture a contiguous stream.
BEFORE a consequential decision verify and capture the exact observation into durable admitted evidence.
PIN captured observation identity/time/source in Case guards; later live values cannot silently replace consented input.
REAUTHORIZE each dispatch and reconnect; revoked streams close without hidden metadata payload.
RECORD provider outages honestly; historical snapshots cannot be relabeled as current live data.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
The Case pins an explicit captured quote; it never relies on an unrecorded last-rendered browser value
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-033
SubscribeLive(binding,subjects,grant) -> EntitledSubscription; ObserveFeed(envelope) -> TransientState; CaptureObservation(binding,sequence,maxAge,operationId) -> CapturedObservationRef | SourceStale; SealFeedRange(range) -> DatasetProposal.

live feed transport is non-authoritative and bounded; ontology.feed_bindings(binding_id PK,world_id,provider,feed_contract,entitlement_ref); ontology.live_captures(capture_id PK,world_id,binding_id,provider_sequence,event_time,acquired_at,digest,evidence_ref,rights_ref); ontology.feed_gaps(gap_id PK,binding_id,sequence_range,state). Sealed history publishes through normal datasets.

[algorithm SPEC-033](../../docs/algorithms/spec-033.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
