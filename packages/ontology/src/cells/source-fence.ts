// @zoen-plan packages/ontology/src/cells/source-fence.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/cells/source-fence.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/cells/source-fence.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-042](../../../../docs/specs/spec-042.md).
// Tickets: [ZN-0247](../../../../docs/tickets/zn-0247.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0247 /* planning label, not a public API */
//   OWNER := SPEC-042; TARGET := packages/ontology/src/cells/source-fence.ts
//   REQUIRE accepted dependencies: ZN-0246
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     COPY World into fenced non-authoritative destination with exact release, data pins, rights and open-work inventory.
//     REPLAY complete source commits; compare expected cut and deterministic validation evidence.
//     ACQUIRE exclusive source head fence; stop new writes/permits and persist final fence receipt/cut.
//     REQUIRE source acknowledgement or approved infrastructure fencing that proves source cannot act; uncertainty blocks promotion.
//     CAS durable coordinator directory from expected source epoch to destination epoch.
//     INSTALL destination write admission for the new epoch, then permit routing; old boot/backup defaults fenced.
//     PRESERVE stable external effect identities and reconcile any escaped requests independently of cell ownership.
//     ON partial failure keep at most one admitted writer; do not sacrifice fencing to preserve availability.
//   TICKET-SPECIFIC SEGMENT:
//     01. Take the exclusive head transition and disable new writes/permits.
//     02. Drain/transfer queued jobs and record final cut plus unknown escaped effects.
//     03. Refuse automatic promotion when source fencing cannot be established.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN The source is network-partitioned and still running
//     WHEN An operator requests destination promotion
//     THEN Promotion blocks absent verified source/infrastructure fencing; health-check timeout is not treated as proof the source stopped
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
