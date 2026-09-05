// @zoen-plan packages/ontology/src/evidence/capture-gc.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/evidence/capture-gc.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/evidence/capture-gc.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-004](../../../../docs/specs/spec-004.md).
// Tickets: [ZN-0029](../../../../docs/tickets/zn-0029.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0029 /* planning label, not a public API */
//   OWNER := SPEC-004; TARGET := packages/ontology/src/evidence/capture-gc.ts
//   REQUIRE accepted dependencies: ZN-0028
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
//     01. Track admission and historical pins separately from temporary upload leases.
//     02. Delete only expired unadmitted captures with no pin or pending admission.
//     03. Make GC recheck state after acquiring the capture lock.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN GC races a source admission immediately before upload lease expiry
//     WHEN Both contend for the same capture
//     THEN An admitted/pinned artifact survives; an unreferenced expired orphan can be deleted; no accepted evidence points at GC-deleted bytes
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
