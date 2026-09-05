# File plan — `tests/fixtures/spec-029/artifact-build.json`

**Status:** planned; no product acceptance implied.

Target: `tests/fixtures/spec-029/artifact-build.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-029](../../../docs/specs/spec-029.md).
Tickets: [ZN-0170](../../../docs/tickets/zn-0170.md).

## Responsibility and reuse

```text
CONDITIONAL INPUT FIXTURE PLAN — not an observed service result.
USE synthetic records within owned disposable namespaces and explicit valid/knowledge time.
INCLUDE comparable rivals, a denied source, duplicate provenance family and stale dependency when in scope.
COMPUTE fixed expected values from the owning oracle, not from the implementation under test.
LOAD through the real component/journey boundary; do not replace provider/database behavior with this file.
VERSION seed, units, rights and cleanup scope.
```

## Owning state / operation contracts

### SPEC-029
ProposeArtifact(envelope,bytesRef) -> Candidate; EvaluateArtifact(candidate,EvaluationWorld) -> Proof; InstallArtifact(digest,requestedGrant,operationId) -> Change; RecallArtifact(digest) -> RecallReceipt.

ontology.artifacts(artifact_digest PK,kind,runtime_abi,entrypoint,sbom_ref,provenance_ref,signature_ref,capability_request,resource_profile); ontology.installations(installation_id PK,world_id,artifact_digest,granted_scope,release_ref,state); ontology.artifact_recalls(recall_id PK,digest,reason,effective_at,scope); ontology.artifact_evaluations(evaluation_id PK,digest,profile,report_ref,state). Blobs are retained under controlled object-store policy.

[algorithm SPEC-029](../../../docs/algorithms/spec-029.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
