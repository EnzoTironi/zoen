// @zoen-plan packages/ontology/src/evidence/index.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/evidence/index.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/evidence/index.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-004](../../../../docs/specs/spec-004.md).
// Tickets: [ZN-0025](../../../../docs/tickets/zn-0025.md), [ZN-0026](../../../../docs/tickets/zn-0026.md), [ZN-0027](../../../../docs/tickets/zn-0027.md), [ZN-0028](../../../../docs/tickets/zn-0028.md), [ZN-0029](../../../../docs/tickets/zn-0029.md).
//
// ## Responsibility and reuse
//
// ```text
// COMPOSITION/REGISTRATION PLAN.
// IMPORT only reviewed implemented ports and adapters under the existing dependency direction.
// BIND the existing semantic executor once; register this module's released operation descriptors.
// DO NOT add business rules, source credentials, alternate policy evaluators or a second dispatcher here.
// GATE unavailable capabilities explicitly; an unwired implementation does not satisfy a ticket.
// KEEP shared composition edits under the named exclusive lock.
// ```
//
// ## Owning state / operation contracts
//
// ### SPEC-004
// StageCapture(binding,stream,declaredMetadata) -> CaptureRef | Quarantined; AdmitCapture(captureRef,mappingDigest,operationId) -> AdmissionReceipt; ReadEvidence(evidenceRef,grant) -> AuthorizedStream | HistoricalContentUnavailable.
//
// ontology.source_bindings(binding_id PK,world_id,definition_id,state,credential_ref,acl_revision); ontology.captures(capture_id PK,world_id,binding_id,source_namespace,external_id,revision,blob_ref,digest,acquired_at,state,UNIQUE(world_id,binding_id,external_id,revision,digest)); ontology.evidence(evidence_id PK,world_id,capture_id,rights_ref,validity_json,retention_ref,admission_commit); ontology.source_admissions(binding_id,capture_id,mapping_digest PK,receipt_id). Object keys are opaque World/realm-scoped; object digests are internal.
//
// [algorithm SPEC-004](../../../../docs/algorithms/spec-004.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
