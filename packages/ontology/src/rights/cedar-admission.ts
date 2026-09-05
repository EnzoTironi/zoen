// @zoen-plan packages/ontology/src/rights/cedar-admission.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/rights/cedar-admission.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/rights/cedar-admission.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-018](../../../../docs/specs/spec-018.md).
// Tickets: [ZN-0106](../../../../docs/tickets/zn-0106.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0106 /* planning label, not a public API */
//   OWNER := SPEC-018; TARGET := packages/ontology/src/rights/cedar-admission.ts
//   REQUIRE accepted dependencies: ZN-0018, ZN-0046, ZN-0094, ZN-0105
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
//     01. Admit the Cedar evaluator and schema under the execution lock.
//     02. Map canonical principal/action/resource/context inputs and test forbidden precedence.
//     03. Compile only the reviewed filter subset; reject unrepresentable broad queries.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN A permit and explicit forbid apply to one operation, and a query needs an unsupported policy construct
//     WHEN Authorization and planning run
//     THEN The forbid denies the operation; unsupported planning returns UnsupportedPlan instead of fetching everything for later filtering
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
