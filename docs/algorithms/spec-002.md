# SPEC-002 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-002](../specs/spec-002.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Identity and Kernel**. Module: `packages/door/src`. Milestone: **S0**.

## Normative operation signatures

```text
DoorPort.verify(assertion) -> PresenceProof; CreatePersonalWorld(operationId, seedDigest) -> GenesisReceipt; OpenWorld(worldId,purpose) -> GrantRef | Denied; AcceptInvitation(invitationToken,operationId) -> MembershipReceipt.
```

## State and transaction contract

door.subject_map(subject_id PK, principal_id UNIQUE); ontology.worlds(world_id PK, realm, cell_id, epoch, release_digest, generation_id, security_revision, status); ontology.memberships(world_id,principal_id PK, role, status, revision); ontology.grants(grant_hash PK, world_id, principal_id, purpose, audience_hash, assurance, expires_at, security_revision, scope_json); ontology.invitations(invitation_hash PK, world_id, intended_subject, expires_at, consumed_by). Owner runtime role differs from migration owner.

## Shared algorithm

```text
VERIFY provider presence through DoorPort; map stable provider subject, not email/name, to the principal.
FOR genesis: validate image-pinned seed, operation identity and creation permission; use the existing AuthorityCommit primitive.
ATOMically create World head, initial membership, domains and genesis receipt/outbox; no account-signup implicit World access.
FOR entry: read current membership, assurance, purpose, audience and security revision in the authority context.
ISSUE a random bounded server-side grant stored by digest; Focus and links contain no grant.
FOR invitation: verify intended recipient, expiry and existing policy; consume once with membership receipt; do not replace the World head.
AT use and replay: recheck identity, delegation, revision and expiry before disclosure.
ON revocation: advance deny/security state, reject new use, preserve audit; do not claim to retract delivered data.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0013](../tickets/zn-0013.md) | Integrate Better Auth behind a presence-only port | [packages/door/src/door.ts](../../packages/door/src/door.ts.plan.md) |
| [ZN-0014](../tickets/zn-0014.md) | Implement idempotent private World genesis | [packages/ontology/src/worlds/genesis.ts](../../packages/ontology/src/worlds/genesis.ts.plan.md) |
| [ZN-0015](../tickets/zn-0015.md) | Issue fresh purpose-bound grants and request permits | [packages/ontology/src/worlds/world-entry.ts](../../packages/ontology/src/worlds/world-entry.ts.plan.md) |
| [ZN-0016](../tickets/zn-0016.md) | Implement single-use invitation acceptance | [packages/ontology/src/worlds/invitations.ts](../../packages/ontology/src/worlds/invitations.ts) |
| [ZN-0017](../tickets/zn-0017.md) | Implement session termination and emergency deny | [packages/ontology/src/worlds/revocation.ts](../../packages/ontology/src/worlds/revocation.ts) |
| [ZN-0018](../tickets/zn-0018.md) | Prove genesis and entry isolation on real roles | [packages/ontology/src/worlds/entry-isolation.ts](../../packages/ontology/src/worlds/entry-isolation.ts) |

## Required proof boundaries

No implicit membership on account creation. Validate planted foundation digest at genesis; atomically create head, owner membership and receipt. Entry reads current membership and security revision. Grants are bounded server records, not cached powers embedded in Focus. Identity adapters use official supported flows; the app never implements password cryptography.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
