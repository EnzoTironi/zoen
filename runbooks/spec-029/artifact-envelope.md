# File plan — `runbooks/spec-029/artifact-envelope.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-029/artifact-envelope.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-029](../../docs/specs/spec-029.md).
Tickets: [ZN-0169](../../docs/tickets/zn-0169.md).

## Responsibility and reuse

## ZN-0169 operational/repair procedure

Scope: Define and validate artifact envelopes. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
Artifact admission runs
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
VALIDATE artifact envelope, ABI, entrypoint, dependency lock, provenance/SBOM and exact content digests.
BUILD reproducibly in isolated infrastructure without production credentials or embedded private datasets.
TREAT capability requests as untrusted; compute permitted installation scope using current policy.
EVALUATE hostile/resource/egress behavior in isolated realm and required actual runtime profile.
BIND approved artifact digest and granted scope through the existing release process.
ISSUE execution only while installation, signer policy, runtime qualification and recall status remain valid.
ON recall deny new leases and stop/reconcile existing attempts according to their effect state.
RETAIN necessary pins/receipts; a signature is not proof that guest code cannot copy disclosed data.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
Admission fails; no installation or execution lease exists for substituted bytes
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-029
ProposeArtifact(envelope,bytesRef) -> Candidate; EvaluateArtifact(candidate,EvaluationWorld) -> Proof; InstallArtifact(digest,requestedGrant,operationId) -> Change; RecallArtifact(digest) -> RecallReceipt.

ontology.artifacts(artifact_digest PK,kind,runtime_abi,entrypoint,sbom_ref,provenance_ref,signature_ref,capability_request,resource_profile); ontology.installations(installation_id PK,world_id,artifact_digest,granted_scope,release_ref,state); ontology.artifact_recalls(recall_id PK,digest,reason,effective_at,scope); ontology.artifact_evaluations(evaluation_id PK,digest,profile,report_ref,state). Blobs are retained under controlled object-store policy.

[algorithm SPEC-029](../../docs/algorithms/spec-029.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
