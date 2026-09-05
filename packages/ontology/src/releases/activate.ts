// @zoen-plan packages/ontology/src/releases/activate.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/releases/activate.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/releases/activate.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-014](../../../../docs/specs/spec-014.md).
// Tickets: [ZN-0086](../../../../docs/tickets/zn-0086.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0086 /* planning label, not a public API */
//   OWNER := SPEC-014; TARGET := packages/ontology/src/releases/activate.ts
//   REQUIRE accepted dependencies: ZN-0085
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     ACCEPT edits against stable symbols and expected base; classify instance, definition, artifact or kernel lane.
//     AUTHORIZE proposed change under CURRENT active policy; proposed policy cannot approve itself.
//     COMPILE candidate and compute semantic/permission/consequence diff plus affected dependency closure.
//     EVALUATE in an isolated realm with authorized test inputs, separate leases and sandbox destinations; absent real proof blocks its scope.
//     PREPARE non-authoritative projections/migration from committed cuts; classify Cases, Watches, Mandates and sessions for compatibility.
//     CATCH UP complete committed transitions; expected head or cut change => PreparationStale/rebase, not implicit consent refresh.
//     RECHECK approver/delegation/assurance, exact proof digests and recall/deny before atomic control-head compare-and-swap.
//     ACTIVATE release/generation and receipt together; no mixed active dual-write generation.
//     ROLLBACK as a new proved forward transition; do not revive revoked grants, erased data or replay settled effects.
//   TICKET-SPECIFIC SEGMENT:
//     01. Lock head exclusively and verify expected release/generation/epoch/security and exact prepared cut.
//     02. Reauthorize approvals under the currently active policy.
//     03. Atomically change head and write activation receipt/outbox; fail PreparationStale on new dependencies.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN Data advances after preparation or another release wins activation first
//     WHEN Activation executes
//     THEN No partial switch occurs; it returns stale and requires fresh preparation rather than activating on approximate current data
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
