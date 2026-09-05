# File plan — `tests/fixtures/spec-033/live-seal.json`

**Status:** planned; no product acceptance implied.

Target: `tests/fixtures/spec-033/live-seal.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-033](../../../docs/specs/spec-033.md).
Tickets: [ZN-0195](../../../docs/tickets/zn-0195.md).

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

### SPEC-033
SubscribeLive(binding,subjects,grant) -> EntitledSubscription; ObserveFeed(envelope) -> TransientState; CaptureObservation(binding,sequence,maxAge,operationId) -> CapturedObservationRef | SourceStale; SealFeedRange(range) -> DatasetProposal.

live feed transport is non-authoritative and bounded; ontology.feed_bindings(binding_id PK,world_id,provider,feed_contract,entitlement_ref); ontology.live_captures(capture_id PK,world_id,binding_id,provider_sequence,event_time,acquired_at,digest,evidence_ref,rights_ref); ontology.feed_gaps(gap_id PK,binding_id,sequence_range,state). Sealed history publishes through normal datasets.

[algorithm SPEC-033](../../../docs/algorithms/spec-033.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
