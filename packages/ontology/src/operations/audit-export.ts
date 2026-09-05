// @zoen-plan packages/ontology/src/operations/audit-export.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/operations/audit-export.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/operations/audit-export.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-040](../../../../docs/specs/spec-040.md).
// Tickets: [ZN-0234](../../../../docs/tickets/zn-0234.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0234 /* planning label, not a public API */
//   OWNER := SPEC-040; TARGET := packages/ontology/src/operations/audit-export.ts
//   REQUIRE accepted dependencies: ZN-0233
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     RESOLVE current resource limits by World/principal/profile and reserve before costly work.
//     ACCOUNT for query rows/bytes, concurrency, model tokens, source egress, storage and effect ceilings independently.
//     SCHEDULE under declared fairness/priority; one tenant cannot consume unbounded queue or memory.
//     RECONCILE actual measured usage and bounded unknown costs without negative/double-released reservations.
//     BENCHMARK declared workload with real resources and exact rights selectivity; record distributions and failures.
//     ISSUE capacity certificate only from actual results bound to hardware/profile/commit; targets remain targets.
//     OPEN support metadata-only; content requires scoped purpose, independent approval, expiry and audit.
//     REVOKE support access and redact export evidence; no permanent global content superuser.
//   TICKET-SPECIFIC SEGMENT:
//     01. Export permitted immutable receipt/security events to an admitted destination.
//     02. Test redaction, tamper detection, retention and backpressure.
//     03. Provide revoke/stop/isolate/restore playbooks with named roles and verification checks.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN An export destination fails and the incident involves a compromised runner
//     WHEN Operators follow the runbook
//     THEN Audit gaps are explicit, new runner permits stop and evidence is preserved without broad data disclosure
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
