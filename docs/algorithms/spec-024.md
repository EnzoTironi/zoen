# SPEC-024 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-024](../specs/spec-024.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Kernel and Product**. Module: `packages/ontology/src/mandates`. Milestone: **S4**.

## Normative operation signatures

```text
CreateMandate(definition,scope,budget,operationId) -> Mandate; ReserveBudget(path,amount,operationId) -> Reservation | BudgetExceeded; ObserveGoal(mandate,evidence) -> pending|achieved|failed|unknown|stopped; StopMandate(id) -> StopReceipt.
```

## State and transaction contract

ontology.budgets(budget_id PK,world_id,parent_ref,unit,limit_amount,reserved_amount,spent_amount,version); ontology.reservations(reservation_id PK,budget_id,case_ref,effect_ref,amount,state); ontology.mandates(mandate_id PK,world_id,goal_definition,scope,action_allowlist,budget_ref,deadline,state,outcome,basis_ref); ontology.mandate_steps(step_id PK,mandate_id,action_case_ref,observation_ref,state).

## Shared algorithm

```text
AUTHORIZE goal, permitted action set, deadline, observation rule and resource ceilings.
LOCK root-to-child budget/reservation path deterministically; verify aggregate capacity, not cached balance.
RESERVE before scheduling children/steps; child scope and total budget cannot exceed parent.
USE ordinary ActionCases for consequential steps and preserve stable effect identities across recovery.
OBSERVE goal using authorized evidence; tool completion alone cannot mark goal achieved.
KEEP reservations for ambiguous costly/financial effects until actual evidence and policy justify reconciliation.
STOP/escalate on revoked scope, deadline, repeat failure, missing observation or resource bound.
RETURN achieved/failed/unknown/stopped distinctly with receipts and unresolved external outcomes.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0141](../tickets/zn-0141.md) | Implement transactional reservation conservation | [packages/ontology/src/mandates/reservations.ts](../../packages/ontology/src/mandates/reservations.ts) |
| [ZN-0142](../tickets/zn-0142.md) | Define and create bounded Mandates | [packages/ontology/src/mandates/mandate-contract.ts](../../packages/ontology/src/mandates/mandate-contract.ts) |
| [ZN-0143](../tickets/zn-0143.md) | Observe business outcome independently of step completion | [packages/ontology/src/mandates/outcome-observation.ts](../../packages/ontology/src/mandates/outcome-observation.ts) |
| [ZN-0144](../tickets/zn-0144.md) | Enforce deadlines, repetition limits and emergency stop | [packages/ontology/src/mandates/mandate-stop.ts](../../packages/ontology/src/mandates/mandate-stop.ts) |
| [ZN-0145](../tickets/zn-0145.md) | Bind household, bakery and clinic actions to shared agency | [tests/journey/spec-024/domain-agency.test.ts](../../tests/journey/spec-024/domain-agency.test.ts) |
| [ZN-0146](../tickets/zn-0146.md) | Prove full responsibility loop under failures | [tests/chaos/spec-024/mandate-journey.test.ts](../../tests/chaos/spec-024/mandate-journey.test.ts) |

## Required proof boundaries

Lock root-to-child budget path in deterministic order, never check cached balance alone. Enforce spend/tokens/steps/fanout/egress ceilings. Unknown financial effects retain reservations until policy and evidence justify release. Escalate or stop on deadline, repeated plan failure, missing observation or revoked scope. Child agents cannot obtain more aggregate authority/resources than the parent.

V4 refinement: Background app jobs act under an explicit workload identity/delegation and bounded Mandate. They do not reuse a departed human browser session or inherit the publisher rights.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
