// @zoen-plan tests/migrations/zn-0231.test.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `tests/migrations/zn-0231.test.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `tests/migrations/zn-0231.test.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-040](../../docs/specs/spec-040.md).
// Tickets: [ZN-0231](../../docs/tickets/zn-0231.md).
//
// ## Responsibility and reuse
//
// ```text
// CONDITIONAL SUPPORT SEGMENT.
// FIRST prove this file is needed by an owning ticket; do not implement parallel abstractions merely to fill paths.
// READ the current implementation and shared module algorithm; select only the missing support responsibility.
// KEEP dependency direction and single authority ownership; no provider success stub or ambient credential.
// WIRE into the owning ticket's declared entry and prove its exact tests.
// ```
//
// ## Owning state / operation contracts
//
// ### SPEC-040
// ReserveUsage(world,resource,estimate) -> Reservation | QuotaExceeded; AdmitWorkload(profile,benchmarkReport) -> CapacityCertificate; RequestSupportAccess(scope,purpose) -> TimeBoundCase; ExportAudit(scope,destination) -> AuthorizedArtifact.
//
// ontology.quota_policies(policy_id PK,world_id,resource,limit,window,priority); jobs.usage_reservations(reservation_id PK,world_id,kind,estimate,actual,state); audit.support_sessions(session_id PK,operator,world_scope,purpose,approver,expires_at,state); audit.slo_reports(report_id PK,profile,workload_digest,window,metrics,evidence_ref). Billing ledger references provider entitlements, never raw card data.
//
// [algorithm SPEC-040](../../docs/algorithms/spec-040.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
