# File plan — `runbooks/spec-038/directory-policy.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-038/directory-policy.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-038](../../docs/specs/spec-038.md).
Tickets: [ZN-0221](../../docs/tickets/zn-0221.md).

## Responsibility and reuse

## ZN-0221 operational/repair procedure

Scope: Govern directory-group to World-role mappings. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
A user joins the group
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
VERIFY issuer/audience/signature/time through admitted identity library and current metadata rotation contract.
MAP stable issuer/subject identifiers; do not merge accounts solely by email.
PROCESS SCIM create/update/deactivate idempotently with provider revision and local guards.
APPLY group-to-role mapping only within released organization policy; directory data cannot expand platform trust.
ON deactivation revoke current access, browser/workload bindings and streams at documented boundaries.
REACTIVATION is a fresh governed mapping, not replay of old privileges.
MINT distinct workload identity with narrow scope, rotation/expiry and attributable delegation chain.
QUALIFY actual IdP/SCIM tenant and failure modes; no development administrator or fake SSO bypass.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
No World authority is granted; the mapping appears as an unresolved provisioning configuration
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-038
AuthenticateEnterprise(assertion,connection) -> PresenceProof; ApplyDirectoryChange(connection,event) -> ProvisioningReceipt; ReconcileDirectory(connection,cut) -> Differences; MintWorkloadIdentity(scope) -> NarrowCredential.

door.enterprise_connections(connection_id PK,organization_ref,protocol,issuer,metadata_digest,state); door.directory_subjects(connection_id,external_id PK,principal_ref,version,active); ontology.directory_mappings(mapping_id PK,world_id,connection_id,group_ref,role_scope,release_ref); audit.provisioning_events(event_id PK,connection_id,provider_event_ref,state,receipt_ref). Workloads have distinct principals, not shared human sessions.

[algorithm SPEC-038](../../docs/algorithms/spec-038.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
