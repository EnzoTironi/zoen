# SPEC-033 — Entitled live feeds, gap-aware subscriptions and action capture

**Milestone:** S7 · **Owner:** Data Platform · **Root:** `packages/ontology/src/live`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Live observations are entitled transient overlays, not automatically durable facts. Conflated and unconflated feeds are distinct contracts. Consequential use requires exact captured evidence with age/sequence/rights guards.

## Owned state and storage contract
live feed transport is non-authoritative and bounded; ontology.feed_bindings(binding_id PK,world_id,provider,feed_contract,entitlement_ref); ontology.live_captures(capture_id PK,world_id,binding_id,provider_sequence,event_time,acquired_at,digest,evidence_ref,rights_ref); ontology.feed_gaps(gap_id PK,binding_id,sequence_range,state). Sealed history publishes through normal datasets.

## Operations

```text
SubscribeLive(binding,subjects,grant) -> EntitledSubscription; ObserveFeed(envelope) -> TransientState; CaptureObservation(binding,sequence,maxAge,operationId) -> CapturedObservationRef | SourceStale; SealFeedRange(range) -> DatasetProposal.
```

## Execution protocol
Validate provider sequence, subject alias, unit/currency, clocks, quality and entitlement. Make gap/out-of-order state explicit. Never recover discarded unconflated events from a conflated stream. Bound client fanout and reconnect catch-up. Captures verify current entitlement and exact bytes before Action proposal; final commit checks age/identity/feed guards.

V4 refinement: Apps subscribe through the common executor and entitlement checks. A WebSocket or SSE handshake does not authorize the lifetime of the stream; send/resume/queue-flush reauthorize. No raw feed endpoint for a chart.

V4 normative detail: [single semantic path](../architecture/semantic-path.md).

## Pseudocode and file ownership

[algorithm SPEC-033](../algorithms/spec-033.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0192](../tickets/zn-0192.md) | Implement versioned live envelopes and sequencing | component | [ZN-0134](../tickets/zn-0134.md), [ZN-0185](../tickets/zn-0185.md), [ZN-0191](../tickets/zn-0191.md) |
| [ZN-0193](../tickets/zn-0193.md) | Enforce live entitlement and bounded fanout | component | [ZN-0192](../tickets/zn-0192.md) |
| [ZN-0194](../tickets/zn-0194.md) | Capture exact live values before consequential use | component | [ZN-0193](../tickets/zn-0193.md) |
| [ZN-0195](../tickets/zn-0195.md) | Seal live history with sequence coverage metadata | component | [ZN-0194](../tickets/zn-0194.md) |
| [ZN-0196](../tickets/zn-0196.md) | Prove capture freshness, entitlement and reconnect races | journey | [ZN-0195](../tickets/zn-0195.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `data-events-parquet.md`, `data-flows-and-live-data.md`. Read a named historical reference only when needed; it cannot override current contracts.
