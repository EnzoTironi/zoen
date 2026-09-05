// @zoen-plan tests/migrations/zn-0015.test.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `tests/migrations/zn-0015.test.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `tests/migrations/zn-0015.test.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-002](../../docs/specs/spec-002.md).
// Tickets: [ZN-0015](../../docs/tickets/zn-0015.md).
//
// ## Responsibility and reuse
//
// ```text
// CONDITIONAL SUPPORT SEGMENT.
// FIRST prove this file is needed by an owning ticket; do not implement parallel abstractions merely to fill paths.
// READ the current implementation and shared module algorithm; select only the missing support responsibility.
// KEEP dependency direction and single authority ownership; no provider success stub or ambient credential.
// WIRE into the owning ticket's declared entry and prove its exact tests.
// ```
//
// ## Owning state / operation contracts
//
// ### SPEC-002
// DoorPort.verify(assertion) -> PresenceProof; CreatePersonalWorld(operationId, seedDigest) -> GenesisReceipt; OpenWorld(worldId,purpose) -> GrantRef | Denied; AcceptInvitation(invitationToken,operationId) -> MembershipReceipt.
//
// door.subject_map(subject_id PK, principal_id UNIQUE); ontology.worlds(world_id PK, realm, cell_id, epoch, release_digest, generation_id, security_revision, status); ontology.memberships(world_id,principal_id PK, role, status, revision); ontology.grants(grant_hash PK, world_id, principal_id, purpose, audience_hash, assurance, expires_at, security_revision, scope_json); ontology.invitations(invitation_hash PK, world_id, intended_subject, expires_at, consumed_by). Owner runtime role differs from migration owner.
//
// [algorithm SPEC-002](../../docs/algorithms/spec-002.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
