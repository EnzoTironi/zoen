# SPEC-038 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-038](../specs/spec-038.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Enterprise Security**. Module: `packages/door/src/enterprise`. Milestone: **S9**.

## Normative operation signatures

```text
AuthenticateEnterprise(assertion,connection) -> PresenceProof; ApplyDirectoryChange(connection,event) -> ProvisioningReceipt; ReconcileDirectory(connection,cut) -> Differences; MintWorkloadIdentity(scope) -> NarrowCredential.
```

## State and transaction contract

door.enterprise_connections(connection_id PK,organization_ref,protocol,issuer,metadata_digest,state); door.directory_subjects(connection_id,external_id PK,principal_ref,version,active); ontology.directory_mappings(mapping_id PK,world_id,connection_id,group_ref,role_scope,release_ref); audit.provisioning_events(event_id PK,connection_id,provider_event_ref,state,receipt_ref). Workloads have distinct principals, not shared human sessions.

## Shared algorithm

```text
VERIFY issuer/audience/signature/time through admitted identity library and current metadata rotation contract.
MAP stable issuer/subject identifiers; do not merge accounts solely by email.
PROCESS SCIM create/update/deactivate idempotently with provider revision and local guards.
APPLY group-to-role mapping only within released organization policy; directory data cannot expand platform trust.
ON deactivation revoke current access, browser/workload bindings and streams at documented boundaries.
REACTIVATION is a fresh governed mapping, not replay of old privileges.
MINT distinct workload identity with narrow scope, rotation/expiry and attributable delegation chain.
QUALIFY actual IdP/SCIM tenant and failure modes; no development administrator or fake SSO bypass.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0219](../tickets/zn-0219.md) | Admit enterprise OIDC/SAML connections | [packages/door/src/enterprise/enterprise-sso.ts](../../packages/door/src/enterprise/enterprise-sso.ts) |
| [ZN-0220](../tickets/zn-0220.md) | Implement idempotent SCIM provisioning and deactivation | [packages/door/src/enterprise/scim.ts](../../packages/door/src/enterprise/scim.ts) |
| [ZN-0221](../tickets/zn-0221.md) | Govern directory-group to World-role mappings | [packages/door/src/enterprise/directory-policy.ts](../../packages/door/src/enterprise/directory-policy.ts) |
| [ZN-0222](../tickets/zn-0222.md) | Implement workload identities and delegated clients | [packages/door/src/enterprise/workload-identity.ts](../../packages/door/src/enterprise/workload-identity.ts) |
| [ZN-0223](../tickets/zn-0223.md) | Prove deprovisioning across in-flight work | [tests/journey/spec-038/enterprise-identity-journey.test.ts](../../tests/journey/spec-038/enterprise-identity-journey.test.ts) |
| [ZN-0224](../tickets/zn-0224.md) | Qualify enterprise identity provider operations | [admissions/spec-038/identity-provider-qualification.json](../../admissions/spec-038/identity-provider-qualification.json.plan.md) |

## Required proof boundaries

Validate issuer/audience/signatures through admitted provider libraries and metadata rotation profiles. Use stable external subject IDs, not email matching. SCIM create/update/deactivate is idempotent with revision guards. Group mapping cannot auto-grant beyond released policy. Deactivation revokes access conservatively; restoring a user is a fresh authorized transition, not replay of old groups.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
