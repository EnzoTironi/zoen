# File plan — `runbooks/spec-002/revocation.md`

**Status:** implementation-in-progress; no product acceptance implied.

Target: `runbooks/spec-002/revocation.md`. Representation: **existing-with-sidecar**. Allocation: **required**.

Specs: [SPEC-002](../../docs/specs/spec-002.md).
Tickets: [ZN-0017](../../docs/tickets/zn-0017.md).

## Responsibility and reuse

The adjacent implementation is preserved. Read it first, extend it in place, and prove behavior at the ticket's required layer. Do not replace it with this plan or create a duplicate primitive.

## ZN-0017 operational/repair procedure

Scope: Implement session termination and emergency deny. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
The final disclosure check runs after revocation commits
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
VERIFY provider presence through DoorPort; map stable provider subject, not email/name, to the principal.
FOR genesis: validate image-pinned seed, operation identity and creation permission; use the existing AuthorityCommit primitive.
ATOMically create World head, initial membership, domains and genesis receipt/outbox; no account-signup implicit World access.
FOR entry: read current membership, assurance, purpose, audience and security revision in the authority context.
ISSUE a random bounded server-side grant stored by digest; Focus and links contain no grant.
FOR invitation: verify intended recipient, expiry and existing policy; consume once with membership receipt; do not replace the World head.
AT use and replay: recheck identity, delegation, revision and expiry before disclosure.
ON revocation: advance deny/security state, reject new use, preserve audit; do not claim to retract delivered data.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
No Frame payload is sent; the client receives a disclosure-safe denial and an audit event records suppression
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-002
DoorPort.verify(assertion) -> PresenceProof; CreatePersonalWorld(operationId, seedDigest) -> GenesisReceipt; OpenWorld(worldId,purpose) -> GrantRef | Denied; AcceptInvitation(invitationToken,operationId) -> MembershipReceipt.

door.subject_map(subject_id PK, principal_id UNIQUE); ontology.worlds(world_id PK, realm, cell_id, epoch, release_digest, generation_id, security_revision, status); ontology.memberships(world_id,principal_id PK, role, status, revision); ontology.grants(grant_hash PK, world_id, principal_id, purpose, audience_hash, assurance, expires_at, security_revision, scope_json); ontology.invitations(invitation_hash PK, world_id, intended_subject, expires_at, consumed_by). Owner runtime role differs from migration owner.

[algorithm SPEC-002](../../docs/algorithms/spec-002.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
