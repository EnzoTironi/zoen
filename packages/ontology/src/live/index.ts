// @zoen-plan packages/ontology/src/live/index.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/live/index.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/live/index.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-033](../../../../docs/specs/spec-033.md).
// Tickets: [ZN-0192](../../../../docs/tickets/zn-0192.md), [ZN-0193](../../../../docs/tickets/zn-0193.md), [ZN-0194](../../../../docs/tickets/zn-0194.md), [ZN-0195](../../../../docs/tickets/zn-0195.md).
//
// ## Responsibility and reuse
//
// ```text
// COMPOSITION/REGISTRATION PLAN.
// IMPORT only reviewed implemented ports and adapters under the existing dependency direction.
// BIND the existing semantic executor once; register this module's released operation descriptors.
// DO NOT add business rules, source credentials, alternate policy evaluators or a second dispatcher here.
// GATE unavailable capabilities explicitly; an unwired implementation does not satisfy a ticket.
// KEEP shared composition edits under the named exclusive lock.
// ```
//
// ## Owning state / operation contracts
//
// ### SPEC-033
// SubscribeLive(binding,subjects,grant) -> EntitledSubscription; ObserveFeed(envelope) -> TransientState; CaptureObservation(binding,sequence,maxAge,operationId) -> CapturedObservationRef | SourceStale; SealFeedRange(range) -> DatasetProposal.
//
// live feed transport is non-authoritative and bounded; ontology.feed_bindings(binding_id PK,world_id,provider,feed_contract,entitlement_ref); ontology.live_captures(capture_id PK,world_id,binding_id,provider_sequence,event_time,acquired_at,digest,evidence_ref,rights_ref); ontology.feed_gaps(gap_id PK,binding_id,sequence_range,state). Sealed history publishes through normal datasets.
//
// [algorithm SPEC-033](../../../../docs/algorithms/spec-033.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
