# File plan — `contracts/spec-002/genesis.schema.json`

**Status:** planned; no product acceptance implied.

Target: `contracts/spec-002/genesis.schema.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-002](../../docs/specs/spec-002.md).
Tickets: [ZN-0014](../../docs/tickets/zn-0014.md).

## Responsibility and reuse

```text
CONDITIONAL SCHEMA PLAN — no permissive {} schema or fabricated generated types.
RESOLVE exact input/output/tagged-error fields from the operation signatures and common protocol.
REQUIRE bounded sizes/depth/arrays, exact discriminants, validated IDs and explicit optional/null distinctions.
REJECT additional or authority-bearing client fields; money/counters stay strings where required.
GENERATE canonical fixtures, wire types and surface descriptors from this single reviewed schema source.
TEST malformed/oversized/unknown-version inputs and exact round trips; registry presence alone is not a pass.
```

## Owning state / operation contracts

### SPEC-002
DoorPort.verify(assertion) -> PresenceProof; CreatePersonalWorld(operationId, seedDigest) -> GenesisReceipt; OpenWorld(worldId,purpose) -> GrantRef | Denied; AcceptInvitation(invitationToken,operationId) -> MembershipReceipt.

door.subject_map(subject_id PK, principal_id UNIQUE); ontology.worlds(world_id PK, realm, cell_id, epoch, release_digest, generation_id, security_revision, status); ontology.memberships(world_id,principal_id PK, role, status, revision); ontology.grants(grant_hash PK, world_id, principal_id, purpose, audience_hash, assurance, expires_at, security_revision, scope_json); ontology.invitations(invitation_hash PK, world_id, intended_subject, expires_at, consumed_by). Owner runtime role differs from migration owner.

[algorithm SPEC-002](../../docs/algorithms/spec-002.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
