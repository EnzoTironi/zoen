# SPEC-002 — Door, World genesis and fresh purpose-bound entry

**Milestone:** S0 · **Owner:** Identity and Kernel · **Root:** `packages/door/src`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Door proves presence only. Ontology creates Worlds and membership through image-pinned governance operations. A phone number, group participation or email From header is never World authority.

## Owned state and storage contract
door.subject_map(subject_id PK, principal_id UNIQUE); ontology.worlds(world_id PK, realm, cell_id, epoch, release_digest, generation_id, security_revision, status); ontology.memberships(world_id,principal_id PK, role, status, revision); ontology.grants(grant_hash PK, world_id, principal_id, purpose, audience_hash, assurance, expires_at, security_revision, scope_json); ontology.invitations(invitation_hash PK, world_id, intended_subject, expires_at, consumed_by). Owner runtime role differs from migration owner.

## Operations

```text
DoorPort.verify(assertion) -> PresenceProof; CreatePersonalWorld(operationId, seedDigest) -> GenesisReceipt; OpenWorld(worldId,purpose) -> GrantRef | Denied; AcceptInvitation(invitationToken,operationId) -> MembershipReceipt.
```

## Execution protocol
No implicit membership on account creation. Validate planted foundation digest at genesis; atomically create head, owner membership and receipt. Entry reads current membership and security revision. Grants are bounded server records, not cached powers embedded in Focus. Identity adapters use official supported flows; the app never implements password cryptography.

Genesis implementation depends on SPEC-003, while SPEC-003 depends only on the presence adapter task of SPEC-002. This task-level split is normative and breaks the bootstrap cycle. World genesis, grants and invitations live in Ontology; Door supplies presence only.

## Pseudocode and file ownership

[algorithm SPEC-002](../algorithms/spec-002.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0013](../tickets/zn-0013.md) | Integrate Better Auth behind a presence-only port | component | [ZN-0012](../tickets/zn-0012.md) |
| [ZN-0014](../tickets/zn-0014.md) | Implement idempotent private World genesis | component | [ZN-0013](../tickets/zn-0013.md), [ZN-0024](../tickets/zn-0024.md) |
| [ZN-0015](../tickets/zn-0015.md) | Issue fresh purpose-bound grants and request permits | component | [ZN-0014](../tickets/zn-0014.md) |
| [ZN-0016](../tickets/zn-0016.md) | Implement single-use invitation acceptance | component | [ZN-0015](../tickets/zn-0015.md) |
| [ZN-0017](../tickets/zn-0017.md) | Implement session termination and emergency deny | component | [ZN-0016](../tickets/zn-0016.md) |
| [ZN-0018](../tickets/zn-0018.md) | Prove genesis and entry isolation on real roles | component | [ZN-0017](../tickets/zn-0017.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `rights-and-access-control.md`, `repository-and-modules.md`, `release-engine-and-compiler.md`. Read a named historical reference only when needed; it cannot override current contracts.
