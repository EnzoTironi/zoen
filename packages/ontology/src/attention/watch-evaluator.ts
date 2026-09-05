// @zoen-plan packages/ontology/src/attention/watch-evaluator.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/attention/watch-evaluator.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/attention/watch-evaluator.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-020](../../../../docs/specs/spec-020.md).
// Tickets: [ZN-0119](../../../../docs/tickets/zn-0119.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0119 /* planning label, not a public API */
//   OWNER := SPEC-020; TARGET := packages/ontology/src/attention/watch-evaluator.ts
//   REQUIRE accepted dependencies: ZN-0118
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     CREATE/Edit/Pause/Resume/Cancel Watch through ordinary governed operations with stable identity.
//     CONSUME complete commits using per-domain cursors; evaluate only released semantic materiality, not every raw tick.
//     ADVANCE checkpoint when unchanged; represent stale-data transitions explicitly.
//     ATOMically create one Notice and outbox for a new semantic transition; duplicate evaluation cannot notify twice.
//     EVE receives opaque Notice reference and freshly authorizes its view before composition.
//     APPLY relationship attention policy: silence, merge, defer or deliver with quiet hours and consent.
//     REAUTHORIZE after deferral and before every stream/delivery flush; revocation yields no hidden tombstone.
//     EXPLAIN authorized suppression and pending work; lack of a message is not loss of the durable Notice.
//   TICKET-SPECIFIC SEGMENT:
//     01. Process committed domain transitions rather than raw source ticks.
//     02. Evaluate materiality using exact released thresholds and unknown semantics.
//     03. Emit one Notice or advance a compact checkpoint atomically.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN A supplier delivery moves by an immaterial amount, then crosses a critical deadline; later the source becomes stale
//     WHEN Evaluation consumes the transitions twice
//     THEN The noise is silent; each material/stale transition creates one canonical Notice with its basis
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
