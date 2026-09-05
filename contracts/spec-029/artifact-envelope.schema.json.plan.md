# File plan — `contracts/spec-029/artifact-envelope.schema.json`

**Status:** planned; no product acceptance implied.

Target: `contracts/spec-029/artifact-envelope.schema.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-029](../../docs/specs/spec-029.md).
Tickets: [ZN-0169](../../docs/tickets/zn-0169.md).

## Responsibility and reuse

```text
CONDITIONAL SCHEMA PLAN — no permissive {} schema or fabricated generated types.
RESOLVE exact input/output/tagged-error fields from the operation signatures and common protocol.
REQUIRE bounded sizes/depth/arrays, exact discriminants, validated IDs and explicit optional/null distinctions.
REJECT additional or authority-bearing client fields; money/counters stay strings where required.
GENERATE canonical fixtures, wire types and surface descriptors from this single reviewed schema source.
TEST malformed/oversized/unknown-version inputs and exact round trips; registry presence alone is not a pass.
```

## Owning state / operation contracts

### SPEC-029
ProposeArtifact(envelope,bytesRef) -> Candidate; EvaluateArtifact(candidate,EvaluationWorld) -> Proof; InstallArtifact(digest,requestedGrant,operationId) -> Change; RecallArtifact(digest) -> RecallReceipt.

ontology.artifacts(artifact_digest PK,kind,runtime_abi,entrypoint,sbom_ref,provenance_ref,signature_ref,capability_request,resource_profile); ontology.installations(installation_id PK,world_id,artifact_digest,granted_scope,release_ref,state); ontology.artifact_recalls(recall_id PK,digest,reason,effective_at,scope); ontology.artifact_evaluations(evaluation_id PK,digest,profile,report_ref,state). Blobs are retained under controlled object-store policy.

[algorithm SPEC-029](../../docs/algorithms/spec-029.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
