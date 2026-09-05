# SPEC-033 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-033](../specs/spec-033.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Data Platform**. Module: `packages/ontology/src/live`. Milestone: **S7**.

## Normative operation signatures

```text
SubscribeLive(binding,subjects,grant) -> EntitledSubscription; ObserveFeed(envelope) -> TransientState; CaptureObservation(binding,sequence,maxAge,operationId) -> CapturedObservationRef | SourceStale; SealFeedRange(range) -> DatasetProposal.
```

## State and transaction contract

live feed transport is non-authoritative and bounded; ontology.feed_bindings(binding_id PK,world_id,provider,feed_contract,entitlement_ref); ontology.live_captures(capture_id PK,world_id,binding_id,provider_sequence,event_time,acquired_at,digest,evidence_ref,rights_ref); ontology.feed_gaps(gap_id PK,binding_id,sequence_range,state). Sealed history publishes through normal datasets.

## Shared algorithm

```text
VERIFY source entitlement, stream identity, sequence/clock/watermark and observed schema.
KEEP transient live plane separate from World authority; annotate gaps, duplicates, stale data and reconnect state.
SERVE subscriptions through released semantic operations with current policy and bounded backpressure.
DROP/coalesce only under declared display semantics; never quietly manufacture a contiguous stream.
BEFORE a consequential decision verify and capture the exact observation into durable admitted evidence.
PIN captured observation identity/time/source in Case guards; later live values cannot silently replace consented input.
REAUTHORIZE each dispatch and reconnect; revoked streams close without hidden metadata payload.
RECORD provider outages honestly; historical snapshots cannot be relabeled as current live data.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0192](../tickets/zn-0192.md) | Implement versioned live envelopes and sequencing | [packages/ontology/src/live/live-envelope.ts](../../packages/ontology/src/live/live-envelope.ts) |
| [ZN-0193](../tickets/zn-0193.md) | Enforce live entitlement and bounded fanout | [packages/ontology/src/live/live-entitlement.ts](../../packages/ontology/src/live/live-entitlement.ts) |
| [ZN-0194](../tickets/zn-0194.md) | Capture exact live values before consequential use | [packages/ontology/src/live/live-capture.ts](../../packages/ontology/src/live/live-capture.ts) |
| [ZN-0195](../tickets/zn-0195.md) | Seal live history with sequence coverage metadata | [packages/ontology/src/live/live-seal.ts](../../packages/ontology/src/live/live-seal.ts) |
| [ZN-0196](../tickets/zn-0196.md) | Prove capture freshness, entitlement and reconnect races | [tests/journey/spec-033/live-journey.test.ts](../../tests/journey/spec-033/live-journey.test.ts) |

## Required proof boundaries

Validate provider sequence, subject alias, unit/currency, clocks, quality and entitlement. Make gap/out-of-order state explicit. Never recover discarded unconflated events from a conflated stream. Bound client fanout and reconnect catch-up. Captures verify current entitlement and exact bytes before Action proposal; final commit checks age/identity/feed guards.

V4 refinement: Apps subscribe through the common executor and entitlement checks. A WebSocket or SSE handshake does not authorize the lifetime of the stream; send/resume/queue-flush reauthorize. No raw feed endpoint for a chart.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
