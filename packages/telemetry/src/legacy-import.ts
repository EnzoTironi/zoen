// @zoen-plan packages/telemetry/src/legacy-import.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/telemetry/src/legacy-import.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/telemetry/src/legacy-import.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-008](../../../docs/specs/spec-008.md).
// Tickets: [ZN-0050](../../../docs/tickets/zn-0050.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0050 /* planning label, not a public API */
//   OWNER := SPEC-008; TARGET := packages/telemetry/src/legacy-import.ts
//   REQUIRE accepted dependencies: ZN-0049
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     EMIT correlation identifiers and bounded operational events; exclude credentials, documents, prompts and hidden reasoning.
//     DISTINGUISH liveness from readiness for actual admitted dependencies and enabled capabilities.
//     CAPTURE backup manifests covering authority cuts, object pins, deletion ledger references and escaped effects.
//     RESTORE into isolated read-only/dispatch-disabled infrastructure, never over a live unknown tenant.
//     REPLAY current deletion suppression before any user read; verify missing objects and role separation.
//     RECONCILE escaped external attempts using original identities; Unknown stays Unknown.
//     MEASURE recovery against the actual fixture/profile and publish commands plus observations, not assumed service guarantees.
//     ADMIT writes/dispatch only after current operator approval and failed checks are resolved.
//   TICKET-SPECIFIC SEGMENT:
//     01. Record legacy data/meaning/rights mappings as versioned manifests.
//     02. Import into evaluation through normal admission, never copy old membership blindly.
//     03. Produce counts, unmatched rows and semantic diffs for owner approval before any cutover.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN Legacy exports contain unmatched subjects and a broad administrator role
//     WHEN A migration rehearsal runs in evaluation
//     THEN All discrepancies are reported; the administrator role is not auto-granted and OS production remains unchanged
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
