// @zoen-plan packages/ontology/src/compute/virtual-source.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/compute/virtual-source.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/compute/virtual-source.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-034](../../../../docs/specs/spec-034.md).
// Tickets: [ZN-0197](../../../../docs/tickets/zn-0197.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0197 /* planning label, not a public API */
//   OWNER := SPEC-034; TARGET := packages/ontology/src/compute/virtual-source.ts
//   REQUIRE accepted dependencies: ZN-0178, ZN-0185, ZN-0191
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
//     01. Represent external snapshot support, query bounds, rights, completeness and retention.
//     02. Capture sufficient result evidence when allowed.
//     03. Reject time-travel claims without external snapshot/captured data.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN A remote warehouse supports current reads but no historical snapshot reference
//     WHEN A historical Frame is requested
//     THEN The system returns unsupported/unavailable or a retained captured basis; it never labels a fresh query as historical
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
