// @zoen-plan packages/ontology/src/attention/attention-policy.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/attention/attention-policy.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/attention/attention-policy.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-020](../../../../docs/specs/spec-020.md).
// Tickets: [ZN-0120](../../../../docs/tickets/zn-0120.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0120 /* planning label, not a public API */
//   OWNER := SPEC-020; TARGET := packages/ontology/src/attention/attention-policy.ts
//   REQUIRE accepted dependencies: ZN-0119
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
//     01. Choose silence, merge, defer or delivery using relationship preferences and budgets.
//     02. Keep independent Notice semantics when merging wording.
//     03. Persist arbitration reason and scheduled reconsideration.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN Three related supplier Notices arrive during quiet hours
//     WHEN Eve arbitrates
//     THEN It can defer/merge into one permitted message without losing the three source Notice references or inventing urgency
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
