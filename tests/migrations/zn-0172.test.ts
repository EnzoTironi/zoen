// @zoen-plan tests/migrations/zn-0172.test.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `tests/migrations/zn-0172.test.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `tests/migrations/zn-0172.test.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-029](../../docs/specs/spec-029.md).
// Tickets: [ZN-0172](../../docs/tickets/zn-0172.md).
//
// ## Responsibility and reuse
//
// ```text
// CONDITIONAL SUPPORT SEGMENT.
// FIRST prove this file is needed by an owning ticket; do not implement parallel abstractions merely to fill paths.
// READ the current implementation and shared module algorithm; select only the missing support responsibility.
// KEEP dependency direction and single authority ownership; no provider success stub or ambient credential.
// WIRE into the owning ticket's declared entry and prove its exact tests.
// ```
//
// ## Owning state / operation contracts
//
// ### SPEC-029
// ProposeArtifact(envelope,bytesRef) -> Candidate; EvaluateArtifact(candidate,EvaluationWorld) -> Proof; InstallArtifact(digest,requestedGrant,operationId) -> Change; RecallArtifact(digest) -> RecallReceipt.
//
// ontology.artifacts(artifact_digest PK,kind,runtime_abi,entrypoint,sbom_ref,provenance_ref,signature_ref,capability_request,resource_profile); ontology.installations(installation_id PK,world_id,artifact_digest,granted_scope,release_ref,state); ontology.artifact_recalls(recall_id PK,digest,reason,effective_at,scope); ontology.artifact_evaluations(evaluation_id PK,digest,profile,report_ref,state). Blobs are retained under controlled object-store policy.
//
// [algorithm SPEC-029](../../docs/algorithms/spec-029.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
