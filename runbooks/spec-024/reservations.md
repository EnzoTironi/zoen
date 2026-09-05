# File plan — `runbooks/spec-024/reservations.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-024/reservations.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-024](../../docs/specs/spec-024.md).
Tickets: [ZN-0141](../../docs/tickets/zn-0141.md).

## Responsibility and reuse

## ZN-0141 operational/repair procedure

Scope: Implement transactional reservation conservation. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
Reservations race
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
AUTHORIZE goal, permitted action set, deadline, observation rule and resource ceilings.
LOCK root-to-child budget/reservation path deterministically; verify aggregate capacity, not cached balance.
RESERVE before scheduling children/steps; child scope and total budget cannot exceed parent.
USE ordinary ActionCases for consequential steps and preserve stable effect identities across recovery.
OBSERVE goal using authorized evidence; tool completion alone cannot mark goal achieved.
KEEP reservations for ambiguous costly/financial effects until actual evidence and policy justify reconciliation.
STOP/escalate on revoked scope, deadline, repeat failure, missing observation or resource bound.
RETURN achieved/failed/unknown/stopped distinctly with receipts and unresolved external outcomes.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
At most one 70.00 reservation succeeds; aggregate reserved plus spent never exceeds the admitted limit
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-024
CreateMandate(definition,scope,budget,operationId) -> Mandate; ReserveBudget(path,amount,operationId) -> Reservation | BudgetExceeded; ObserveGoal(mandate,evidence) -> pending|achieved|failed|unknown|stopped; StopMandate(id) -> StopReceipt.

ontology.budgets(budget_id PK,world_id,parent_ref,unit,limit_amount,reserved_amount,spent_amount,version); ontology.reservations(reservation_id PK,budget_id,case_ref,effect_ref,amount,state); ontology.mandates(mandate_id PK,world_id,goal_definition,scope,action_allowlist,budget_ref,deadline,state,outcome,basis_ref); ontology.mandate_steps(step_id PK,mandate_id,action_case_ref,observation_ref,state).

[algorithm SPEC-024](../../docs/algorithms/spec-024.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
