// @zoen-plan packages/ontology/src/live/live-envelope.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/live/live-envelope.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/live/live-envelope.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-033](../../../../docs/specs/spec-033.md).
// Tickets: [ZN-0192](../../../../docs/tickets/zn-0192.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0192 /* planning label, not a public API */
//   OWNER := SPEC-033; TARGET := packages/ontology/src/live/live-envelope.ts
//   REQUIRE accepted dependencies: ZN-0134, ZN-0185, ZN-0191
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
//     01. Define feed, instrument/subject alias, sequence, clocks, quality, entitlement and conflation metadata.
//     02. Validate monotonic/reorder rules per provider profile.
//     03. Expose missing sequence ranges and staleness instead of interpolating certainty.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN A sequence jumps from 100 to 103 then 101 arrives late
//     WHEN The feed adapter processes it
//     THEN The gap is explicit and late-event handling follows the declared profile without claiming complete order-book state
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
