// @zoen-plan packages/ontology/src/sources/tombstones.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/sources/tombstones.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/sources/tombstones.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-015](../../../../docs/specs/spec-015.md).
// Tickets: [ZN-0094](../../../../docs/tickets/zn-0094.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0094 /* planning label, not a public API */
//   OWNER := SPEC-015; TARGET := packages/ontology/src/sources/tombstones.ts
//   REQUIRE accepted dependencies: ZN-0093
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     REGISTER provider recipe and instance separately; record credential references only.
//     VALIDATE scopes, source namespaces, allowed destinations, query templates, incremental strategy and license/ACL behavior.
//     PERFORM real OAuth binding through supported provider flow; validate state/PKCE/redirect contract in admitted adapter.
//     STORE secret material only in broker-owned secret storage; runtime definition sees an opaque binding reference.
//     ACQUIRE bounded source pages with watermark and request identity; source missing page is not deletion.
//     CHECK current source rights/freshness; stage raw capture before mapping/admission through existing evidence machinery.
//     COMMIT checkpoints only after durable capture/admission position; deduplicate replay without dropping genuine revision changes.
//     QUALIFY each actual source account/profile; missing permission or credentials keeps that binding disabled, not emulated.
//   TICKET-SPECIFIC SEGMENT:
//     01. Admit deletion events with source revision/evidence.
//     02. Distinguish authoritative complete snapshot absence from pagination gaps and outage.
//     03. Cascade invalidation to derived projections while retaining permitted historical receipts.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN A paginated API omits one page versus an explicit delete event for the same record
//     WHEN Both are processed
//     THEN Only the explicit/proven-complete deletion produces a tombstone; outage never invents nonexistence
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
