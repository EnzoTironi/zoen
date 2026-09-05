# SPEC-004 — Retained evidence and file-based source admission

**Milestone:** S0 · **Owner:** Data · **Root:** `packages/ontology/src/evidence`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Bytes are captured before semantic admission. A hash authenticates byte identity, not factual truth. The initial slice accepts authorized text/CSV/JSON and bounded attachments; rich extraction is added through isolated, attributed extractors.

## Owned state and storage contract
ontology.source_bindings(binding_id PK,world_id,definition_id,state,credential_ref,acl_revision); ontology.captures(capture_id PK,world_id,binding_id,source_namespace,external_id,revision,blob_ref,digest,acquired_at,state,UNIQUE(world_id,binding_id,external_id,revision,digest)); ontology.evidence(evidence_id PK,world_id,capture_id,rights_ref,validity_json,retention_ref,admission_commit); ontology.source_admissions(binding_id,capture_id,mapping_digest PK,receipt_id). Object keys are opaque World/realm-scoped; object digests are internal.

## Operations

```text
StageCapture(binding,stream,declaredMetadata) -> CaptureRef | Quarantined; AdmitCapture(captureRef,mappingDigest,operationId) -> AdmissionReceipt; ReadEvidence(evidenceRef,grant) -> AuthorizedStream | HistoricalContentUnavailable.
```

## Execution protocol
Enforce size/type/count limits while streaming; verify final digest and durable storage before admission. Source namespace and revision form identity, not file names. Runtime records reference secrets but do not contain them. One admission writes evidence, claims, receipt and outbox atomically. Failed admission leaves a quarantined/orphaned capture with a cleanup policy. Missing source output is not deletion.

## Pseudocode and file ownership

[algorithm SPEC-004](../algorithms/spec-004.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0025](../tickets/zn-0025.md) | Stage bounded artifacts with integrity and quarantine | component | [ZN-0024](../tickets/zn-0024.md) |
| [ZN-0026](../tickets/zn-0026.md) | Map source records into attributed evidence | component | [ZN-0025](../tickets/zn-0025.md) |
| [ZN-0027](../tickets/zn-0027.md) | Enforce evidence reads through current rights | component | [ZN-0026](../tickets/zn-0026.md) |
| [ZN-0028](../tickets/zn-0028.md) | Implement initial CSV and JSON extraction profiles | component | [ZN-0027](../tickets/zn-0027.md) |
| [ZN-0029](../tickets/zn-0029.md) | Handle capture orphans and retention pins safely | component | [ZN-0028](../tickets/zn-0028.md) |
| [ZN-0030](../tickets/zn-0030.md) | Prove the two-source file journey end to end | journey | [ZN-0029](../tickets/zn-0029.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `connectors-and-ingestion.md`, `truth-reconciliation-and-learning.md`, `data-events-parquet.md`. Read a named historical reference only when needed; it cannot override current contracts.
