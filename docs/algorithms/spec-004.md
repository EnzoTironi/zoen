# SPEC-004 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-004](../specs/spec-004.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Data**. Module: `packages/ontology/src/evidence`. Milestone: **S0**.

## Normative operation signatures

```text
StageCapture(binding,stream,declaredMetadata) -> CaptureRef | Quarantined; AdmitCapture(captureRef,mappingDigest,operationId) -> AdmissionReceipt; ReadEvidence(evidenceRef,grant) -> AuthorizedStream | HistoricalContentUnavailable.
```

## State and transaction contract

ontology.source_bindings(binding_id PK,world_id,definition_id,state,credential_ref,acl_revision); ontology.captures(capture_id PK,world_id,binding_id,source_namespace,external_id,revision,blob_ref,digest,acquired_at,state,UNIQUE(world_id,binding_id,external_id,revision,digest)); ontology.evidence(evidence_id PK,world_id,capture_id,rights_ref,validity_json,retention_ref,admission_commit); ontology.source_admissions(binding_id,capture_id,mapping_digest PK,receipt_id). Object keys are opaque World/realm-scoped; object digests are internal.

## Shared algorithm

```text
VALIDATE source binding, acquisition permission, content/size limits and retention profile.
STREAM to a quarantined opaque namespace with bounded memory; reject traversal, decompression abuse and inconsistent type.
VERIFY actual durable bytes and final digest before permitting semantic admission.
RESOLVE source namespace, record identity, external revision and mapping digest; filenames are not domain identity.
NORMALIZE using released mapping; retain attribution, rights, units, valid time and copy-family lineage.
COMMIT evidence, candidate claims and stable admission receipt through AuthorityCommit; duplicate admission returns the same allowed result.
ON failure retain explicit quarantined/orphan status; cleanup checks pending admission and retention pins first.
READ through current rights with bounded delivery; erased/unavailable content returns explicit unavailability, never reconstructed bytes.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0025](../tickets/zn-0025.md) | Stage bounded artifacts with integrity and quarantine | [packages/ontology/src/evidence/capture.ts](../../packages/ontology/src/evidence/capture.ts) |
| [ZN-0026](../tickets/zn-0026.md) | Map source records into attributed evidence | [packages/ontology/src/evidence/admission.ts](../../packages/ontology/src/evidence/admission.ts) |
| [ZN-0027](../tickets/zn-0027.md) | Enforce evidence reads through current rights | [packages/ontology/src/evidence/evidence-read.ts](../../packages/ontology/src/evidence/evidence-read.ts) |
| [ZN-0028](../tickets/zn-0028.md) | Implement initial CSV and JSON extraction profiles | [packages/ontology/src/evidence/extract.ts](../../packages/ontology/src/evidence/extract.ts) |
| [ZN-0029](../tickets/zn-0029.md) | Handle capture orphans and retention pins safely | [packages/ontology/src/evidence/capture-gc.ts](../../packages/ontology/src/evidence/capture-gc.ts) |
| [ZN-0030](../tickets/zn-0030.md) | Prove the two-source file journey end to end | [tests/journey/spec-004/file-journey.test.ts](../../tests/journey/spec-004/file-journey.test.ts) |

## Required proof boundaries

Enforce size/type/count limits while streaming; verify final digest and durable storage before admission. Source namespace and revision form identity, not file names. Runtime records reference secrets but do not contain them. One admission writes evidence, claims, receipt and outbox atomically. Failed admission leaves a quarantined/orphaned capture with a cleanup policy. Missing source output is not deletion.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
