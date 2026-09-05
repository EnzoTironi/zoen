// @zoen-plan packages/ontology/src/attention/watch-inspector.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/attention/watch-inspector.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/attention/watch-inspector.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-020](../../../../docs/specs/spec-020.md).
// Tickets: [ZN-0122](../../../../docs/tickets/zn-0122.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0122 /* planning label, not a public API */
//   OWNER := SPEC-020; TARGET := packages/ontology/src/attention/watch-inspector.ts
//   REQUIRE accepted dependencies: ZN-0121
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
//     01. Show authorized watched conditions, latest basis, pending Notices and suppression reasons.
//     02. Resume subscriptions from committed cursor without exposing hidden tombstones.
//     03. Require fresh grant on reconnect.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN A client disconnects before a change and reconnects after membership revocation
//     WHEN It requests catch-up
//     THEN The subscription closes without leaking change IDs or deleted hidden objects; an authorized reconnect catches up exactly once semantically
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
