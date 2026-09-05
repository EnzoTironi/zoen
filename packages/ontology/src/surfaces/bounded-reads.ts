// @zoen-plan packages/ontology/src/surfaces/bounded-reads.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/surfaces/bounded-reads.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/surfaces/bounded-reads.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-050](../../../../docs/specs/spec-050.md).
// Tickets: [ZN-0294](../../../../docs/tickets/zn-0294.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0294 /* planning label, not a public API */
//   OWNER := SPEC-050; TARGET := packages/ontology/src/surfaces/bounded-reads.ts
//   REQUIRE accepted dependencies: ZN-0158, ZN-0162, ZN-0293
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     NORMALIZE transport input into the common envelope; obtain identity and app/workload context only from verified server bindings.
//     RESOLVE allowed operation using the existing SPEC-007 dispatcher; do not instantiate another executor.
//     PRESERVE intent ID, contract digest, basis and purpose on retry/resumption; a new ID is a new intention.
//     INTERSECT current user/delegation rights, admitted app capabilities and current source restrictions centrally.
//     FOR batches/streams/exports support bounded work and exact basis; reauthorize each item/chunk/resumption.
//     CACHE only with full subject/World/delegation/app/purpose/release/query/cut/security key; references are not permits.
//     COMPARE canonical semantic outcomes under equivalent authority/basis, not natural-language presentation.
//     AUDIT every ingress/asset/export/worker path for bypasses; structured app calls require neither Eve nor an LLM.
//   TICKET-SPECIFIC SEGMENT:
//     01. Add versioned batch-inspect/query descriptors with bounded operations/rows/output and an explicit coherent read basis.
//     02. Implement opaque cursor and export handles bound to the same authorized plan; each page/chunk retrieval rechecks rights.
//     03. Keep async work admission separate from result retrieval and respect cancellation/backpressure; never expose SQL or a public presigned data URL.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN A permitted 200-row page and a restricted finance field exist
//     WHEN The app and SDK ask for the same authorized aggregate, page and export
//     THEN Results carry equivalent basis/provenance and contain no forbidden field/count; over-limit requests receive QuotaExceeded without partial undisclosed truncation
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
