# File plan — `packages/ontology/src/worlds/index.ts`

**Status:** implementation-in-progress; no product acceptance implied.

Target: `packages/ontology/src/worlds/index.ts`. Representation: **existing-with-sidecar**. Allocation: **conditional-support**.

Specs: [SPEC-002](../../../../docs/specs/spec-002.md).
Tickets: [ZN-0014](../../../../docs/tickets/zn-0014.md), [ZN-0015](../../../../docs/tickets/zn-0015.md), [ZN-0016](../../../../docs/tickets/zn-0016.md), [ZN-0017](../../../../docs/tickets/zn-0017.md), [ZN-0018](../../../../docs/tickets/zn-0018.md).

## Responsibility and reuse

The adjacent implementation is preserved. Read it first, extend it in place, and prove behavior at the ticket's required layer. Do not replace it with this plan or create a duplicate primitive.

```text
COMPOSITION/REGISTRATION PLAN.
IMPORT only reviewed implemented ports and adapters under the existing dependency direction.
BIND the existing semantic executor once; register this module's released operation descriptors.
DO NOT add business rules, source credentials, alternate policy evaluators or a second dispatcher here.
GATE unavailable capabilities explicitly; an unwired implementation does not satisfy a ticket.
KEEP shared composition edits under the named exclusive lock.
```

## Owning state / operation contracts

### SPEC-002
DoorPort.verify(assertion) -> PresenceProof; CreatePersonalWorld(operationId, seedDigest) -> GenesisReceipt; OpenWorld(worldId,purpose) -> GrantRef | Denied; AcceptInvitation(invitationToken,operationId) -> MembershipReceipt.

door.subject_map(subject_id PK, principal_id UNIQUE); ontology.worlds(world_id PK, realm, cell_id, epoch, release_digest, generation_id, security_revision, status); ontology.memberships(world_id,principal_id PK, role, status, revision); ontology.grants(grant_hash PK, world_id, principal_id, purpose, audience_hash, assurance, expires_at, security_revision, scope_json); ontology.invitations(invitation_hash PK, world_id, intended_subject, expires_at, consumed_by). Owner runtime role differs from migration owner.

[algorithm SPEC-002](../../../../docs/algorithms/spec-002.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
