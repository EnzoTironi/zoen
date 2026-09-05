// @zoen-plan packages/ontology/src/lifecycle/retention-policy.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/lifecycle/retention-policy.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/lifecycle/retention-policy.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-019](../../../../docs/specs/spec-019.md).
// Tickets: [ZN-0112](../../../../docs/tickets/zn-0112.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0112 /* planning label, not a public API */
//   OWNER := SPEC-019; TARGET := packages/ontology/src/lifecycle/retention-policy.ts
//   REQUIRE accepted dependencies: ZN-0051, ZN-0111
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
//     01. Attach versioned retention/data-use policies to evidence and derived lineage.
//     02. Prevent indefinite default retention for sensitive sources.
//     03. Check expiry before historical read, model use and export.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN A licensed document remains physically stored after its usage license expires
//     WHEN A user requests it for model context
//     THEN Use is denied even though the blob exists; retained metadata follows its own permitted policy
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
