# SPEC-024 — Budget conservation, bounded Mandates and observed outcomes

**Milestone:** S4 · **Owner:** Kernel and Product · **Root:** `packages/ontology/src/mandates`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
A Mandate is an explicit scope of responsibility, not an unlimited agent loop. It has observable goal, deadline, allowed actions, stop conditions and conserved parent/child budgets. Tool completion never proves the business goal achieved.

## Owned state and storage contract
ontology.budgets(budget_id PK,world_id,parent_ref,unit,limit_amount,reserved_amount,spent_amount,version); ontology.reservations(reservation_id PK,budget_id,case_ref,effect_ref,amount,state); ontology.mandates(mandate_id PK,world_id,goal_definition,scope,action_allowlist,budget_ref,deadline,state,outcome,basis_ref); ontology.mandate_steps(step_id PK,mandate_id,action_case_ref,observation_ref,state).

## Operations

```text
CreateMandate(definition,scope,budget,operationId) -> Mandate; ReserveBudget(path,amount,operationId) -> Reservation | BudgetExceeded; ObserveGoal(mandate,evidence) -> pending|achieved|failed|unknown|stopped; StopMandate(id) -> StopReceipt.
```

## Execution protocol
Lock root-to-child budget path in deterministic order, never check cached balance alone. Enforce spend/tokens/steps/fanout/egress ceilings. Unknown financial effects retain reservations until policy and evidence justify release. Escalate or stop on deadline, repeated plan failure, missing observation or revoked scope. Child agents cannot obtain more aggregate authority/resources than the parent.

V4 refinement: Background app jobs act under an explicit workload identity/delegation and bounded Mandate. They do not reuse a departed human browser session or inherit the publisher rights.

V4 normative detail: [single semantic path](../architecture/semantic-path.md).

## Pseudocode and file ownership

[algorithm SPEC-024](../algorithms/spec-024.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0141](../tickets/zn-0141.md) | Implement transactional reservation conservation | component | [ZN-0123](../tickets/zn-0123.md), [ZN-0134](../tickets/zn-0134.md), [ZN-0139](../tickets/zn-0139.md) |
| [ZN-0142](../tickets/zn-0142.md) | Define and create bounded Mandates | component | [ZN-0141](../tickets/zn-0141.md) |
| [ZN-0143](../tickets/zn-0143.md) | Observe business outcome independently of step completion | component | [ZN-0142](../tickets/zn-0142.md) |
| [ZN-0144](../tickets/zn-0144.md) | Enforce deadlines, repetition limits and emergency stop | component | [ZN-0143](../tickets/zn-0143.md) |
| [ZN-0145](../tickets/zn-0145.md) | Bind household, bakery and clinic actions to shared agency | journey | [ZN-0127](../tickets/zn-0127.md), [ZN-0144](../tickets/zn-0144.md) |
| [ZN-0146](../tickets/zn-0146.md) | Prove full responsibility loop under failures | chaos | [ZN-0145](../tickets/zn-0145.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `watches-mandates-and-outcomes.md`, `actions-effects-and-settlement.md`. Read a named historical reference only when needed; it cannot override current contracts.
