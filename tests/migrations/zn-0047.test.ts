// @zoen-plan tests/migrations/zn-0047.test.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `tests/migrations/zn-0047.test.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `tests/migrations/zn-0047.test.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-008](../../docs/specs/spec-008.md).
// Tickets: [ZN-0047](../../docs/tickets/zn-0047.md).
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
// ### SPEC-008
// Health() -> Liveness; Readiness() -> AdmittedDependencies; ExportOperationalEvidence(scope) -> RedactedReport; RestoreAdmission(backupRef,deletionCut,effectLedger) -> ReadOnlyReady | Blocked.
//
// audit.operational_events(event_id PK,world_ref_nullable,actor_ref,kind,redacted_payload,occurred_at,retention_class); jobs.recovery_fences(cell_id PK,epoch,dispatch_enabled,deletion_ledger_cut); infra migration manifest contains legacy source commit, row counts, rights mapping and unmatched records.
//
// [algorithm SPEC-008](../../docs/algorithms/spec-008.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
