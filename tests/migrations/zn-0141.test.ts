// @zoen-plan tests/migrations/zn-0141.test.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `tests/migrations/zn-0141.test.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `tests/migrations/zn-0141.test.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-024](../../docs/specs/spec-024.md).
// Tickets: [ZN-0141](../../docs/tickets/zn-0141.md).
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
// ### SPEC-024
// CreateMandate(definition,scope,budget,operationId) -> Mandate; ReserveBudget(path,amount,operationId) -> Reservation | BudgetExceeded; ObserveGoal(mandate,evidence) -> pending|achieved|failed|unknown|stopped; StopMandate(id) -> StopReceipt.
//
// ontology.budgets(budget_id PK,world_id,parent_ref,unit,limit_amount,reserved_amount,spent_amount,version); ontology.reservations(reservation_id PK,budget_id,case_ref,effect_ref,amount,state); ontology.mandates(mandate_id PK,world_id,goal_definition,scope,action_allowlist,budget_ref,deadline,state,outcome,basis_ref); ontology.mandate_steps(step_id PK,mandate_id,action_case_ref,observation_ref,state).
//
// [algorithm SPEC-024](../../docs/algorithms/spec-024.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
