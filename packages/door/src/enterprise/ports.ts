// @zoen-plan packages/door/src/enterprise/ports.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/door/src/enterprise/ports.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/door/src/enterprise/ports.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-038](../../../../docs/specs/spec-038.md).
// Tickets: [ZN-0219](../../../../docs/tickets/zn-0219.md), [ZN-0220](../../../../docs/tickets/zn-0220.md), [ZN-0221](../../../../docs/tickets/zn-0221.md), [ZN-0222](../../../../docs/tickets/zn-0222.md).
//
// ## Responsibility and reuse
//
// ```text
// CONTRACT SURFACE PLAN.
// DEFINE only the owning module's input/output/error/state and dependency-port types.
// REUSE branded kernel values, verified context, common semantic envelope and typed results.
// DO NOT export repositories or broad credentials to clients; authority context is server verified.
// SEPARATE versioned semantic meaning from transport metadata and immutable artifacts from mutable runtime state.
// VERIFY consumers use the same contracts and exhaustive tagged outcomes; unsupported shapes fail closed.
// ```
//
// ## Owning state / operation contracts
//
// ### SPEC-038
// AuthenticateEnterprise(assertion,connection) -> PresenceProof; ApplyDirectoryChange(connection,event) -> ProvisioningReceipt; ReconcileDirectory(connection,cut) -> Differences; MintWorkloadIdentity(scope) -> NarrowCredential.
//
// door.enterprise_connections(connection_id PK,organization_ref,protocol,issuer,metadata_digest,state); door.directory_subjects(connection_id,external_id PK,principal_ref,version,active); ontology.directory_mappings(mapping_id PK,world_id,connection_id,group_ref,role_scope,release_ref); audit.provisioning_events(event_id PK,connection_id,provider_event_ref,state,receipt_ref). Workloads have distinct principals, not shared human sessions.
//
// [algorithm SPEC-038](../../../../docs/algorithms/spec-038.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
