// @zoen-plan packages/ontology/src/operations/types.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/operations/types.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/operations/types.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-040](../../../../docs/specs/spec-040.md).
// Tickets: [ZN-0231](../../../../docs/tickets/zn-0231.md), [ZN-0232](../../../../docs/tickets/zn-0232.md), [ZN-0233](../../../../docs/tickets/zn-0233.md), [ZN-0234](../../../../docs/tickets/zn-0234.md).
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
// ### SPEC-040
// ReserveUsage(world,resource,estimate) -> Reservation | QuotaExceeded; AdmitWorkload(profile,benchmarkReport) -> CapacityCertificate; RequestSupportAccess(scope,purpose) -> TimeBoundCase; ExportAudit(scope,destination) -> AuthorizedArtifact.
//
// ontology.quota_policies(policy_id PK,world_id,resource,limit,window,priority); jobs.usage_reservations(reservation_id PK,world_id,kind,estimate,actual,state); audit.support_sessions(session_id PK,operator,world_scope,purpose,approver,expires_at,state); audit.slo_reports(report_id PK,profile,workload_digest,window,metrics,evidence_ref). Billing ledger references provider entitlements, never raw card data.
//
// [algorithm SPEC-040](../../../../docs/algorithms/spec-040.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
