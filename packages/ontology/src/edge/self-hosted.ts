// @zoen-plan packages/ontology/src/edge/self-hosted.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/edge/self-hosted.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/edge/self-hosted.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-044](../../../../docs/specs/spec-044.md).
// Tickets: [ZN-0258](../../../../docs/tickets/zn-0258.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0258 /* planning label, not a public API */
//   OWNER := SPEC-044; TARGET := packages/ontology/src/edge/self-hosted.ts
//   REQUIRE accepted dependencies: ZN-0257
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     REQUIRE a separately admitted child-World profile with bounded rights/resource partition, expiry and clock assumptions.
//     ISSUE lease through parent authority with explicit allowed operations and maximum disconnected horizon.
//     RUN the same admitted semantic implementation in the child; local app caches never become a second authority.
//     REJECT unpartitioned/nonreversible external effects by default; no queue of hidden provider writes awaiting reconnect.
//     RECORD ordered local receipts and observed basis under lease/fence with resource conservation.
//     ON reconnect submit receipts as evidence for reconciliation, not commands to replay blindly.
//     CLASSIFY admitted/conflict/expired results under current parent policy and source state.
//     QUALIFY self-hosted/fleet updates against the same laws; this future product feature is not a testing/service substitute.
//   TICKET-SPECIFIC SEGMENT:
//     01. Publish supported storage, identity, isolation, secret, backup, egress and telemetry contracts.
//     02. Run the same component/security/recovery suites on each proposed platform.
//     03. Reject a docker-compose startup as evidence of production equivalence.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN A self-hosted installation lacks deletion-ledger restore suppression and isolated runners
//     WHEN It requests the full enterprise capability profile
//     THEN Those capabilities remain disabled until equivalent controls are proved
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
