# File plan — `runbooks/spec-004/capture.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-004/capture.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-004](../../docs/specs/spec-004.md).
Tickets: [ZN-0025](../../docs/tickets/zn-0025.md).

## Responsibility and reuse

## ZN-0025 operational/repair procedure

Scope: Stage bounded artifacts with integrity and quarantine. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
All are submitted through StageCapture
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
VALIDATE source binding, acquisition permission, content/size limits and retention profile.
STREAM to a quarantined opaque namespace with bounded memory; reject traversal, decompression abuse and inconsistent type.
VERIFY actual durable bytes and final digest before permitting semantic admission.
RESOLVE source namespace, record identity, external revision and mapping digest; filenames are not domain identity.
NORMALIZE using released mapping; retain attribution, rights, units, valid time and copy-family lineage.
COMMIT evidence, candidate claims and stable admission receipt through AuthorityCommit; duplicate admission returns the same allowed result.
ON failure retain explicit quarantined/orphan status; cleanup checks pending admission and retention pins first.
READ through current rights with bounded delivery; erased/unavailable content returns explicit unavailability, never reconstructed bytes.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
Only the durable verified CSV becomes staged; rejected or incomplete captures create no evidence/claim rows
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-004
StageCapture(binding,stream,declaredMetadata) -> CaptureRef | Quarantined; AdmitCapture(captureRef,mappingDigest,operationId) -> AdmissionReceipt; ReadEvidence(evidenceRef,grant) -> AuthorizedStream | HistoricalContentUnavailable.

ontology.source_bindings(binding_id PK,world_id,definition_id,state,credential_ref,acl_revision); ontology.captures(capture_id PK,world_id,binding_id,source_namespace,external_id,revision,blob_ref,digest,acquired_at,state,UNIQUE(world_id,binding_id,external_id,revision,digest)); ontology.evidence(evidence_id PK,world_id,capture_id,rights_ref,validity_json,retention_ref,admission_commit); ontology.source_admissions(binding_id,capture_id,mapping_digest PK,receipt_id). Object keys are opaque World/realm-scoped; object digests are internal.

[algorithm SPEC-004](../../docs/algorithms/spec-004.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
