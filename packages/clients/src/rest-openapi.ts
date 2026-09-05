// @zoen-plan packages/clients/src/rest-openapi.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/clients/src/rest-openapi.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/clients/src/rest-openapi.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-026](../../../docs/specs/spec-026.md).
// Tickets: [ZN-0153](../../../docs/tickets/zn-0153.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0153 /* planning label, not a public API */
//   OWNER := SPEC-026; TARGET := packages/clients/src/rest-openapi.ts
//   REQUIRE accepted dependencies: ZN-0081, ZN-0111, ZN-0152
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     DISCOVER operations through the existing authorized semantic executor.
//     VALIDATE manifest contract/release digests and admitted protocol editions before generating clients.
//     GENERATE REST/OpenAPI, CLI, TypeScript and MCP descriptors deterministically from the same schemas.
//     PRESERVE semantic operation ID, input digest, basis, purpose and idempotency identity across adapters.
//     NEVER accept annotations/tool approvals as authorization; server verifies every invocation.
//     ON incompatible schema/meaning return ContractChanged rather than coercing consequential input.
//     FOR async results, cursors, exports and reconnects use opaque references plus current authorization.
//     TEST normalized semantic parity, not identical prose, and do not invent runtime changes to previously compiled static types.
//   TICKET-SPECIFIC SEGMENT:
//     01. Generate operation routes and error schemas from the manifest.
//     02. Validate request bodies and stable operation IDs at the edge.
//     03. Keep protected transport metadata out of model-controlled input.
//     04. V4: use the existing SPEC-007 dispatcher and shared SemanticClient; validate no per-surface authorization or reconciliation implementation is introduced.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN The same operation is invoked by raw HTTP and an authorized UI client
//     WHEN Inputs and digest match
//     THEN Both traverse the same semantic handler and produce the same meaning; invalid extra fields are rejected
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
