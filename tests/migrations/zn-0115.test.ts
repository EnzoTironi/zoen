// @zoen-plan tests/migrations/zn-0115.test.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `tests/migrations/zn-0115.test.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `tests/migrations/zn-0115.test.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-019](../../docs/specs/spec-019.md).
// Tickets: [ZN-0115](../../docs/tickets/zn-0115.md).
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
// ### SPEC-019
// RequestErasure(scope) -> ReviewedCase; PlanErasure(case,basis) -> ArtifactClosure; ExecuteErasure(task,permit) -> DeletionReceipt; CheckRestoreSuppression(restoredCut,currentLedger) -> SuppressionPlan | Blocked.
//
// ontology.retention_policies(policy_id PK,scope,purpose,expiry_rule,hold_rules,version); ontology.erasure_cases(case_id PK,scope,requested_by,state,decision_ref); ontology.erasure_tasks(task_id PK,case_id,artifact_ref,store,kind,state,receipt_ref); audit.deletion_ledger(sequence PK,scope_digest,artifact_ref,decision_ref,effective_at); ontology.holds(hold_id PK,scope,authority_evidence,expires_at,state). Deletion ledger durability is separate from a restored application backup.
//
// [algorithm SPEC-019](../../docs/algorithms/spec-019.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
