# File plan — `contracts/spec-004/capture-gc.schema.json`

**Status:** planned; no product acceptance implied.

Target: `contracts/spec-004/capture-gc.schema.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-004](../../docs/specs/spec-004.md).
Tickets: [ZN-0029](../../docs/tickets/zn-0029.md).

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

### SPEC-004
StageCapture(binding,stream,declaredMetadata) -> CaptureRef | Quarantined; AdmitCapture(captureRef,mappingDigest,operationId) -> AdmissionReceipt; ReadEvidence(evidenceRef,grant) -> AuthorizedStream | HistoricalContentUnavailable.

ontology.source_bindings(binding_id PK,world_id,definition_id,state,credential_ref,acl_revision); ontology.captures(capture_id PK,world_id,binding_id,source_namespace,external_id,revision,blob_ref,digest,acquired_at,state,UNIQUE(world_id,binding_id,external_id,revision,digest)); ontology.evidence(evidence_id PK,world_id,capture_id,rights_ref,validity_json,retention_ref,admission_commit); ontology.source_admissions(binding_id,capture_id,mapping_digest PK,receipt_id). Object keys are opaque World/realm-scoped; object digests are internal.

[algorithm SPEC-004](../../docs/algorithms/spec-004.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
