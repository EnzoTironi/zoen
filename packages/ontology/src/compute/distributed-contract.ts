// @zoen-plan packages/ontology/src/compute/distributed-contract.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/compute/distributed-contract.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/compute/distributed-contract.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-034](../../../../docs/specs/spec-034.md).
// Tickets: [ZN-0199](../../../../docs/tickets/zn-0199.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0199 /* planning label, not a public API */
//   OWNER := SPEC-034; TARGET := packages/ontology/src/compute/distributed-contract.ts
//   REQUIRE accepted dependencies: ZN-0198
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     AUTHORIZE virtual-source/query or compute request under released definitions and current license/purpose.
//     PLAN bounded remote work and reserve cost/egress before dispatch; select only admitted actual profile.
//     PIN source/query/version/cut guarantees supported by provider; lack of snapshot coherence remains explicit.
//     BROKER credentials and egress outside guests; no arbitrary remote SQL from an app.
//     RUN tasks under fenced identity and record actual environment, inputs, partitions and result digests.
//     VALIDATE output schema, completeness and lineage before making a published artifact.
//     RETURN partial/unknown when provider guarantees or partitions are missing; retries preserve original task identity.
//     PUBLISH through common authority/dataset interfaces, never install a parallel distributed truth store.
//   TICKET-SPECIFIC SEGMENT:
//     01. Implement submit/running/cancelling/completed/failed/unknown states with stable job identity.
//     02. Bind artifact, input versions, resource/budget constraints and output schema.
//     03. Keep engine-specific implementation behind a port with an admission certificate.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN The engine accepts a compute job then loses the submission response
//     WHEN The scheduler retries
//     THEN It reconciles by stable job identity rather than spawning uncontrolled duplicate jobs; budget and unknown state remain explicit
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
