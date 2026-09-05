# SPEC-029 — Signed capability artifacts and controlled installation

**Milestone:** S6 · **Owner:** Platform Security · **Root:** `packages/ontology/src/artifacts`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Executable variation is real code delivered as a signed isolated artifact, not disguised configuration. Signature proves origin, not safety. Installation records requested versus granted capabilities, exact bytes and evaluation evidence.

## Owned state and storage contract
ontology.artifacts(artifact_digest PK,kind,runtime_abi,entrypoint,sbom_ref,provenance_ref,signature_ref,capability_request,resource_profile); ontology.installations(installation_id PK,world_id,artifact_digest,granted_scope,release_ref,state); ontology.artifact_recalls(recall_id PK,digest,reason,effective_at,scope); ontology.artifact_evaluations(evaluation_id PK,digest,profile,report_ref,state). Blobs are retained under controlled object-store policy.

## Operations

```text
ProposeArtifact(envelope,bytesRef) -> Candidate; EvaluateArtifact(candidate,EvaluationWorld) -> Proof; InstallArtifact(digest,requestedGrant,operationId) -> Change; RecallArtifact(digest) -> RecallReceipt.
```

## Execution protocol
Build in an isolated reproducible pipeline with dependency lock, SBOM and provenance. Validate image/entrypoint/output schemas and capability requests. Run hostile evaluation before installation. Source/effect credentials are brokered separately. A recalled artifact cannot obtain new execution leases; running work is stopped or reconciled according to its effect state.

V4 refinement: An executable app reuses this signed artifact/install/recall contract. Requested capabilities are not granted capabilities. Frontend-only signed bundles need not provision a backend. No credentials, private dataset or bootstrap snapshot may be compiled into an app bundle.

V4 normative detail: [single semantic path](../architecture/semantic-path.md).

## Pseudocode and file ownership

[algorithm SPEC-029](../algorithms/spec-029.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0169](../tickets/zn-0169.md) | Define and validate artifact envelopes | component | [ZN-0088](../tickets/zn-0088.md), [ZN-0146](../tickets/zn-0146.md), [ZN-0158](../tickets/zn-0158.md) |
| [ZN-0170](../tickets/zn-0170.md) | Build isolated provenance and dependency review pipeline | component | [ZN-0169](../tickets/zn-0169.md) |
| [ZN-0171](../tickets/zn-0171.md) | Evaluate capability requests against actual grants | component | [ZN-0170](../tickets/zn-0170.md) |
| [ZN-0172](../tickets/zn-0172.md) | Implement recall and deny new artifact leases | component | [ZN-0171](../tickets/zn-0171.md) |
| [ZN-0173](../tickets/zn-0173.md) | Prove agent-proposed custom connector installation | journey | [ZN-0172](../tickets/zn-0172.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `programmable-compute-and-skills.md`, `domain-packs-and-marketplace.md`. Read a named historical reference only when needed; it cannot override current contracts.
