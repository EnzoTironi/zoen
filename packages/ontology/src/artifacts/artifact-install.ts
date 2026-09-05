// @zoen-plan packages/ontology/src/artifacts/artifact-install.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/artifacts/artifact-install.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/artifacts/artifact-install.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-029](../../../../docs/specs/spec-029.md).
// Tickets: [ZN-0171](../../../../docs/tickets/zn-0171.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0171 /* planning label, not a public API */
//   OWNER := SPEC-029; TARGET := packages/ontology/src/artifacts/artifact-install.ts
//   REQUIRE accepted dependencies: ZN-0170
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     VALIDATE artifact envelope, ABI, entrypoint, dependency lock, provenance/SBOM and exact content digests.
//     BUILD reproducibly in isolated infrastructure without production credentials or embedded private datasets.
//     TREAT capability requests as untrusted; compute permitted installation scope using current policy.
//     EVALUATE hostile/resource/egress behavior in isolated realm and required actual runtime profile.
//     BIND approved artifact digest and granted scope through the existing release process.
//     ISSUE execution only while installation, signer policy, runtime qualification and recall status remain valid.
//     ON recall deny new leases and stop/reconcile existing attempts according to their effect state.
//     RETAIN necessary pins/receipts; a signature is not proof that guest code cannot copy disclosed data.
//   TICKET-SPECIFIC SEGMENT:
//     01. Classify connector, analysis, app and agent profiles.
//     02. Intersect requested capabilities with current principal/World policy.
//     03. Route expanded requests through a new reviewed DefinitionChange and evaluation.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN An agent proposes installation requesting all-source and all-action access
//     WHEN Installation is evaluated
//     THEN Requested capabilities do not become grants; unauthorized expansion is denied and permitted narrow installation is explicit
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
