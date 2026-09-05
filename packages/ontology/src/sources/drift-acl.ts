// @zoen-plan packages/ontology/src/sources/drift-acl.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/sources/drift-acl.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/sources/drift-acl.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-015](../../../../docs/specs/spec-015.md).
// Tickets: [ZN-0093](../../../../docs/tickets/zn-0093.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0093 /* planning label, not a public API */
//   OWNER := SPEC-015; TARGET := packages/ontology/src/sources/drift-acl.ts
//   REQUIRE accepted dependencies: ZN-0092
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
//     01. Compare incoming schema/revision against the pinned source contract.
//     02. Quarantine incompatible fields and require a governed mapping change.
//     03. Translate source principal/group ACLs without widening grants; expire stale ACL leases.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN A salary field changes type and a source group is removed
//     WHEN The next synchronization runs
//     THEN The schema change is quarantined; removed access stops disclosure even if content remains indexed
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
