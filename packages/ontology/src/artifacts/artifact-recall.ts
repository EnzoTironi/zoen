// @zoen-plan packages/ontology/src/artifacts/artifact-recall.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/artifacts/artifact-recall.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/artifacts/artifact-recall.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-029](../../../../docs/specs/spec-029.md).
// Tickets: [ZN-0172](../../../../docs/tickets/zn-0172.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0172 /* planning label, not a public API */
//   OWNER := SPEC-029; TARGET := packages/ontology/src/artifacts/artifact-recall.ts
//   REQUIRE accepted dependencies: ZN-0171
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
//     01. Record scoped recall using current governance.
//     02. Revoke new execution permits and notify affected installations.
//     03. Reconcile escaped effects and retain historical receipts tied to the original digest.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN A malicious artifact is recalled while one execution is queued and another has sent a provider request
//     WHEN Recall propagates
//     THEN Queued execution cannot start; in-flight uncertainty is reported rather than pretending recall undid the external request
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
