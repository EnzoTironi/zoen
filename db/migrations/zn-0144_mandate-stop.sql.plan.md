# File plan — `db/migrations/zn-0144_mandate-stop.sql`

**Status:** planned; no product acceptance implied.

Target: `db/migrations/zn-0144_mandate-stop.sql`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-024](../../docs/specs/spec-024.md).
Tickets: [ZN-0144](../../docs/tickets/zn-0144.md).

## Responsibility and reuse

```text
CONDITIONAL MIGRATION PLAN — never feed this Markdown to a migrator.
IF no durable invariant is introduced by the owning ticket: do not create a no-op SQL migration.
OTHERWISE acquire the global schema lock; inspect existing catalog and table owner before adding DDL.
DECLARE explicit types, primary/unique keys, World+realm composite foreign references and indexes.
SEPARATE migrator DDL from runtime roles; parameterize values and retain source/rights/retention lineage.
ORDER expand → backfill → validate → contract, with restartable bounded backfill.
TEST empty database, prior-schema upgrade, role denials, crash boundary and forward repair using real PostgreSQL.
ASSIGN final monotonic migration number only when the genuine SQL is reviewed; never pre-record a planned migration as applied.
```

## Owning state / operation contracts

### SPEC-024
CreateMandate(definition,scope,budget,operationId) -> Mandate; ReserveBudget(path,amount,operationId) -> Reservation | BudgetExceeded; ObserveGoal(mandate,evidence) -> pending|achieved|failed|unknown|stopped; StopMandate(id) -> StopReceipt.

ontology.budgets(budget_id PK,world_id,parent_ref,unit,limit_amount,reserved_amount,spent_amount,version); ontology.reservations(reservation_id PK,budget_id,case_ref,effect_ref,amount,state); ontology.mandates(mandate_id PK,world_id,goal_definition,scope,action_allowlist,budget_ref,deadline,state,outcome,basis_ref); ontology.mandate_steps(step_id PK,mandate_id,action_case_ref,observation_ref,state).

[algorithm SPEC-024](../../docs/algorithms/spec-024.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
