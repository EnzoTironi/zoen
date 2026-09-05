// @zoen-plan packages/ontology/src/evidence/capture.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/evidence/capture.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/evidence/capture.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-004](../../../../docs/specs/spec-004.md).
// Tickets: [ZN-0025](../../../../docs/tickets/zn-0025.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0025 /* planning label, not a public API */
//   OWNER := SPEC-004; TARGET := packages/ontology/src/evidence/capture.ts
//   REQUIRE accepted dependencies: ZN-0024
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     VALIDATE source binding, acquisition permission, content/size limits and retention profile.
//     STREAM to a quarantined opaque namespace with bounded memory; reject traversal, decompression abuse and inconsistent type.
//     VERIFY actual durable bytes and final digest before permitting semantic admission.
//     RESOLVE source namespace, record identity, external revision and mapping digest; filenames are not domain identity.
//     NORMALIZE using released mapping; retain attribution, rights, units, valid time and copy-family lineage.
//     COMMIT evidence, candidate claims and stable admission receipt through AuthorityCommit; duplicate admission returns the same allowed result.
//     ON failure retain explicit quarantined/orphan status; cleanup checks pending admission and retention pins first.
//     READ through current rights with bounded delivery; erased/unavailable content returns explicit unavailability, never reconstructed bytes.
//   TICKET-SPECIFIC SEGMENT:
//     01. Stream at most the source-profile byte limit to an isolated object namespace.
//     02. Check declared/observed content type, reject path traversal and decompression bombs, and verify digest after upload.
//     03. Record capture state without admitting any facts.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN A valid CSV, oversized archive and failed object-store upload
//     WHEN All are submitted through StageCapture
//     THEN Only the durable verified CSV becomes staged; rejected or incomplete captures create no evidence/claim rows
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
