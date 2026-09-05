# SPEC-038 — Enterprise SSO, SCIM and workload identity lifecycle

**Milestone:** S9 · **Owner:** Enterprise Security · **Root:** `packages/door/src/enterprise`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Enterprise identity assertions do not replace World policy. Directory groups map into explicit governed membership rules. Deprovisioning is a security transition that invalidates grants, pending disclosure and new effect permits without erasing historical accountability.

## Owned state and storage contract
door.enterprise_connections(connection_id PK,organization_ref,protocol,issuer,metadata_digest,state); door.directory_subjects(connection_id,external_id PK,principal_ref,version,active); ontology.directory_mappings(mapping_id PK,world_id,connection_id,group_ref,role_scope,release_ref); audit.provisioning_events(event_id PK,connection_id,provider_event_ref,state,receipt_ref). Workloads have distinct principals, not shared human sessions.

## Operations

```text
AuthenticateEnterprise(assertion,connection) -> PresenceProof; ApplyDirectoryChange(connection,event) -> ProvisioningReceipt; ReconcileDirectory(connection,cut) -> Differences; MintWorkloadIdentity(scope) -> NarrowCredential.
```

## Execution protocol
Validate issuer/audience/signatures through admitted provider libraries and metadata rotation profiles. Use stable external subject IDs, not email matching. SCIM create/update/deactivate is idempotent with revision guards. Group mapping cannot auto-grant beyond released policy. Deactivation revokes access conservatively; restoring a user is a fresh authorized transition, not replay of old groups.

## Pseudocode and file ownership

[algorithm SPEC-038](../algorithms/spec-038.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0219](../tickets/zn-0219.md) | Admit enterprise OIDC/SAML connections | component | [ZN-0111](../tickets/zn-0111.md), [ZN-0117](../tickets/zn-0117.md), [ZN-0158](../tickets/zn-0158.md) |
| [ZN-0220](../tickets/zn-0220.md) | Implement idempotent SCIM provisioning and deactivation | component | [ZN-0219](../tickets/zn-0219.md) |
| [ZN-0221](../tickets/zn-0221.md) | Govern directory-group to World-role mappings | component | [ZN-0220](../tickets/zn-0220.md) |
| [ZN-0222](../tickets/zn-0222.md) | Implement workload identities and delegated clients | component | [ZN-0221](../tickets/zn-0221.md) |
| [ZN-0223](../tickets/zn-0223.md) | Prove deprovisioning across in-flight work | journey | [ZN-0222](../tickets/zn-0222.md) |
| [ZN-0224](../tickets/zn-0224.md) | Qualify enterprise identity provider operations | admission | [ZN-0223](../tickets/zn-0223.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `rights-and-access-control.md`, `security-and-operations.md`. Read a named historical reference only when needed; it cannot override current contracts.
