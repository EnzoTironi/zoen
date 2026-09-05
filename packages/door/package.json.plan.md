# File plan — `packages/door/package.json`

**Status:** planned; no product acceptance implied.

Target: `packages/door/package.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-000](../../docs/specs/spec-000.md), [SPEC-002](../../docs/specs/spec-002.md), [SPEC-038](../../docs/specs/spec-038.md).
Tickets: [ZN-0003](../../docs/tickets/zn-0003.md), [ZN-0013](../../docs/tickets/zn-0013.md), [ZN-0219](../../docs/tickets/zn-0219.md).

## Responsibility and reuse

```text
CONDITIONAL SUPPORT SEGMENT.
FIRST prove this file is needed by an owning ticket; do not implement parallel abstractions merely to fill paths.
READ the current implementation and shared module algorithm; select only the missing support responsibility.
KEEP dependency direction and single authority ownership; no provider success stub or ambient credential.
WIRE into the owning ticket's declared entry and prove its exact tests.
```

## Owning state / operation contracts

### SPEC-000
AdmitExecutionProfile(profile, candidateVersions, integrityDigests, compatibilityReport) -> AdmittedLock | Blocked; VerifyTicket(ticketId, commit, profile) -> EvidenceReport | MissingPrerequisite.

No application tables. Track execution-lock.json, baseline-inventory.json and evidence-index.json as reviewed artifacts. Secret values never belong in these files.

[algorithm SPEC-000](../../docs/algorithms/spec-000.md)

### SPEC-002
DoorPort.verify(assertion) -> PresenceProof; CreatePersonalWorld(operationId, seedDigest) -> GenesisReceipt; OpenWorld(worldId,purpose) -> GrantRef | Denied; AcceptInvitation(invitationToken,operationId) -> MembershipReceipt.

door.subject_map(subject_id PK, principal_id UNIQUE); ontology.worlds(world_id PK, realm, cell_id, epoch, release_digest, generation_id, security_revision, status); ontology.memberships(world_id,principal_id PK, role, status, revision); ontology.grants(grant_hash PK, world_id, principal_id, purpose, audience_hash, assurance, expires_at, security_revision, scope_json); ontology.invitations(invitation_hash PK, world_id, intended_subject, expires_at, consumed_by). Owner runtime role differs from migration owner.

[algorithm SPEC-002](../../docs/algorithms/spec-002.md)

### SPEC-038
AuthenticateEnterprise(assertion,connection) -> PresenceProof; ApplyDirectoryChange(connection,event) -> ProvisioningReceipt; ReconcileDirectory(connection,cut) -> Differences; MintWorkloadIdentity(scope) -> NarrowCredential.

door.enterprise_connections(connection_id PK,organization_ref,protocol,issuer,metadata_digest,state); door.directory_subjects(connection_id,external_id PK,principal_ref,version,active); ontology.directory_mappings(mapping_id PK,world_id,connection_id,group_ref,role_scope,release_ref); audit.provisioning_events(event_id PK,connection_id,provider_event_ref,state,receipt_ref). Workloads have distinct principals, not shared human sessions.

[algorithm SPEC-038](../../docs/algorithms/spec-038.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
