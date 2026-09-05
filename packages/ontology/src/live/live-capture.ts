// @zoen-plan packages/ontology/src/live/live-capture.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/live/live-capture.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/live/live-capture.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-033](../../../../docs/specs/spec-033.md).
// Tickets: [ZN-0194](../../../../docs/tickets/zn-0194.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0194 /* planning label, not a public API */
//   OWNER := SPEC-033; TARGET := packages/ontology/src/live/live-capture.ts
//   REQUIRE accepted dependencies: ZN-0193
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     VERIFY source entitlement, stream identity, sequence/clock/watermark and observed schema.
//     KEEP transient live plane separate from World authority; annotate gaps, duplicates, stale data and reconnect state.
//     SERVE subscriptions through released semantic operations with current policy and bounded backpressure.
//     DROP/coalesce only under declared display semantics; never quietly manufacture a contiguous stream.
//     BEFORE a consequential decision verify and capture the exact observation into durable admitted evidence.
//     PIN captured observation identity/time/source in Case guards; later live values cannot silently replace consented input.
//     REAUTHORIZE each dispatch and reconnect; revoked streams close without hidden metadata payload.
//     RECORD provider outages honestly; historical snapshots cannot be relabeled as current live data.
//   TICKET-SPECIFIC SEGMENT:
//     01. Select exact source sequence/bytes under current entitlement and maximum age.
//     02. Admit immutable evidence and return a CapturedObservationRef.
//     03. Add capture identity, clock and feed validity guards to the ActionCase.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN The browser displays a price but a newer quote arrives before an order is proposed
//     WHEN The user authorizes an order basis
//     THEN The Case pins an explicit captured quote; it never relies on an unrecorded last-rendered browser value
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
