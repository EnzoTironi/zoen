# SPEC-029 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-029](../specs/spec-029.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Platform Security**. Module: `packages/ontology/src/artifacts`. Milestone: **S6**.

## Normative operation signatures

```text
ProposeArtifact(envelope,bytesRef) -> Candidate; EvaluateArtifact(candidate,EvaluationWorld) -> Proof; InstallArtifact(digest,requestedGrant,operationId) -> Change; RecallArtifact(digest) -> RecallReceipt.
```

## State and transaction contract

ontology.artifacts(artifact_digest PK,kind,runtime_abi,entrypoint,sbom_ref,provenance_ref,signature_ref,capability_request,resource_profile); ontology.installations(installation_id PK,world_id,artifact_digest,granted_scope,release_ref,state); ontology.artifact_recalls(recall_id PK,digest,reason,effective_at,scope); ontology.artifact_evaluations(evaluation_id PK,digest,profile,report_ref,state). Blobs are retained under controlled object-store policy.

## Shared algorithm

```text
VALIDATE artifact envelope, ABI, entrypoint, dependency lock, provenance/SBOM and exact content digests.
BUILD reproducibly in isolated infrastructure without production credentials or embedded private datasets.
TREAT capability requests as untrusted; compute permitted installation scope using current policy.
EVALUATE hostile/resource/egress behavior in isolated realm and required actual runtime profile.
BIND approved artifact digest and granted scope through the existing release process.
ISSUE execution only while installation, signer policy, runtime qualification and recall status remain valid.
ON recall deny new leases and stop/reconcile existing attempts according to their effect state.
RETAIN necessary pins/receipts; a signature is not proof that guest code cannot copy disclosed data.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0169](../tickets/zn-0169.md) | Define and validate artifact envelopes | [packages/ontology/src/artifacts/artifact-envelope.ts](../../packages/ontology/src/artifacts/artifact-envelope.ts) |
| [ZN-0170](../tickets/zn-0170.md) | Build isolated provenance and dependency review pipeline | [packages/ontology/src/artifacts/artifact-build.ts](../../packages/ontology/src/artifacts/artifact-build.ts) |
| [ZN-0171](../tickets/zn-0171.md) | Evaluate capability requests against actual grants | [packages/ontology/src/artifacts/artifact-install.ts](../../packages/ontology/src/artifacts/artifact-install.ts) |
| [ZN-0172](../tickets/zn-0172.md) | Implement recall and deny new artifact leases | [packages/ontology/src/artifacts/artifact-recall.ts](../../packages/ontology/src/artifacts/artifact-recall.ts) |
| [ZN-0173](../tickets/zn-0173.md) | Prove agent-proposed custom connector installation | [tests/journey/spec-029/artifact-journey.test.ts](../../tests/journey/spec-029/artifact-journey.test.ts) |

## Required proof boundaries

Build in an isolated reproducible pipeline with dependency lock, SBOM and provenance. Validate image/entrypoint/output schemas and capability requests. Run hostile evaluation before installation. Source/effect credentials are brokered separately. A recalled artifact cannot obtain new execution leases; running work is stopped or reconciled according to its effect state.

V4 refinement: An executable app reuses this signed artifact/install/recall contract. Requested capabilities are not granted capabilities. Frontend-only signed bundles need not provision a backend. No credentials, private dataset or bootstrap snapshot may be compiled into an app bundle.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
