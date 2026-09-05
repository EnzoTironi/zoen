// @zoen-plan packages/ontology/src/lifecycle/legal-hold.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/lifecycle/legal-hold.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/lifecycle/legal-hold.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-019](../../../../docs/specs/spec-019.md).
// Tickets: [ZN-0115](../../../../docs/tickets/zn-0115.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0115 /* planning label, not a public API */
//   OWNER := SPEC-019; TARGET := packages/ontology/src/lifecycle/legal-hold.ts
//   REQUIRE accepted dependencies: ZN-0114
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     AUTHORIZE and scope erasure request; check current retention, license, legal holds and required approvers.
//     ENUMERATE controlled originals and derivatives by lineage: blobs, claims, extracts, indexes, embeddings, summaries, caches, dataset files and exports.
//     CREATE idempotent per-store tasks and independently durable deletion ledger entries with permitted metadata only.
//     EXECUTE actual deletion under narrow store authority; observe completion before marking task done.
//     REPORT unavailable third-party erasure or retained legal hold as unresolved/held, not successful destruction.
//     INVALIDATE affected Frames, queries, app sessions/caches and derivative artifacts without leaking deleted content.
//     ON restore apply CURRENT ledger beyond backup cut before opening reads or dispatch.
//     PRESERVE only authorized non-content explanation that historical content is unavailable; no resurrection from old releases.
//   TICKET-SPECIFIC SEGMENT:
//     01. Detect applicable hold/license/deletion conflicts before irreversible work.
//     02. Require recorded responsible-owner decision and policy basis.
//     03. Keep the requested route blocked while the conflict is unresolved.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN An erasure request intersects a documented active hold
//     WHEN The agent attempts automatic deletion or silent retention
//     THEN Neither hidden choice is allowed; the case records the conflict and awaits authorized review
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
