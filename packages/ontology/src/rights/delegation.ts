// @zoen-plan packages/ontology/src/rights/delegation.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/rights/delegation.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/rights/delegation.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-018](../../../../docs/specs/spec-018.md).
// Tickets: [ZN-0107](../../../../docs/tickets/zn-0107.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0107 /* planning label, not a public API */
//   OWNER := SPEC-018; TARGET := packages/ontology/src/rights/delegation.ts
//   REQUIRE accepted dependencies: ZN-0106
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     INPUT: verified principal/delegation, operation, resource set, purpose, destination, app/session and current source licenses.
//     RESOLVE current membership, security revision, revocations, expiry and assurance; explicit deny takes precedence.
//     INTERSECT app/workload requested scope with admitted scope and caller rights; publisher privileges never transfer implicitly.
//     CONSTRUCT authorized ID/field/evidence set before ranking/counting/query execution using the supported policy profile.
//     IF safe bounded restriction cannot be produced, reject plan rather than compile arbitrary policy to permissive SQL.
//     DERIVE output labels from contributing sources and transformation rules; hidden rivals cannot influence unauthorized views.
//     RECHECK before replay/result/chunk/resumption; source ACL staleness blocks the affected disclosure.
//     RECORD permitted disclosure metadata, never hidden data or the existence of denied resources in public errors.
//   TICKET-SPECIFIC SEGMENT:
//     01. Intersect child scope, purpose, destination, expiry and budget with the parent.
//     02. Require explicit grant and step-up for consequential delegated operations.
//     03. Revoke descendants conservatively and prevent cyclic/expired chains.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN A caregiver is invited to view one household bill but asks to transfer money
//     WHEN The delegate invokes the broader action
//     THEN The action is denied; family relationship and channel participation never imply financial authority
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
