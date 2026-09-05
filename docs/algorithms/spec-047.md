# SPEC-047 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-047](../specs/spec-047.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Finance Domain**. Module: `packs/finance/execution`. Milestone: **S11**.

## Normative operation signatures

```text
ProposeOrder(intent,basis) -> RiskBoundActionCase; ObserveBrokerEvent(rawEvidence) -> OrderLifecycleReceipt; AllocateExecution(execution,accounts) -> AllocationCase; ObserveCustody(movementEvidence) -> SettlementReceipt; ReviewCollaboration(space,policy) -> SupervisedView.
```

## State and transaction contract

Released objects: Order, OrderRevision, BrokerRequest, Execution, ExecutionCorrection, Allocation, ClearingObligation, CustodyMovement, SettlementObservation and SupervisedConversation. Stable provider/account/order/execution IDs are scoped; quantity and fee/currency conservation are checked in normal domain Actions.

## Shared algorithm

```text
FORM order ActionCase with exact account/instrument/side/quantity/price/venue/consequences and pre-trade guards.
RESERVE limits/funds/inventory atomically with local decision and stable order/effect identity.
SEND only through current admitted effect permit and actual provider contract; acknowledgement is not fill or settlement.
RECONCILE fills/corrections/cancel-replace using provider sequence/identity; duplicates cannot double count.
TREAT partial fills, cancel races, rejected replacements and ambiguous transmission as separate observable states.
ALLOCATE executed quantities with exact conservation and governed account rights.
RECORD custody/financial settlement from actual external evidence; disagreement stays a reconciliation case.
SUPERVISE communications/actions under licensed retention and participation rules without granting World membership.
REQUIRE real operating/regulatory/provider qualification; never label local test receipts as market execution.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0273](../tickets/zn-0273.md) | Implement order submission and acknowledged lifecycle | [packs/finance/execution/spec-047/order-lifecycle.json](../../packs/finance/execution/spec-047/order-lifecycle.json.plan.md) |
| [ZN-0274](../tickets/zn-0274.md) | Implement executions, corrections and quantity conservation | [packs/finance/execution/spec-047/executions.json](../../packs/finance/execution/spec-047/executions.json.plan.md) |
| [ZN-0275](../tickets/zn-0275.md) | Handle cancel/replace, partial and fill races | [packs/finance/execution/spec-047/cancel-replace.json](../../packs/finance/execution/spec-047/cancel-replace.json.plan.md) |
| [ZN-0276](../tickets/zn-0276.md) | Implement allocations and clearing obligations | [packs/finance/execution/spec-047/allocations.json](../../packs/finance/execution/spec-047/allocations.json.plan.md) |
| [ZN-0277](../tickets/zn-0277.md) | Observe actual custody/cash settlement and fails | [packs/finance/execution/spec-047/custody-settlement.json](../../packs/finance/execution/spec-047/custody-settlement.json.plan.md) |
| [ZN-0278](../tickets/zn-0278.md) | Implement supervised professional collaboration | [packs/finance/execution/spec-047/supervision.json](../../packs/finance/execution/spec-047/supervision.json.plan.md) |
| [ZN-0279](../tickets/zn-0279.md) | Prove full finance lifecycle under adversarial ordering | [tests/chaos/spec-047/finance-lifecycle-journey.test.ts](../../tests/chaos/spec-047/finance-lifecycle-journey.test.ts) |
| [ZN-0280](../tickets/zn-0280.md) | Certify each broker, custodian and regulated operating scope | [admissions/spec-047/finance-certification.json](../../admissions/spec-047/finance-certification.json.plan.md) |

## Required proof boundaries

Orders preserve original quantity/terms and replacement/cancel chains. Deduplicate broker event identity. Track ordered, active filled, busted, allocated, cancelled remainder and open quantity with explicit conservation. A 100-unit order filled 40 then busted 10 has active fill 30 and 70 remaining before other events; settlement is a separate observation. Partial/unknown outcomes retain reservations. Professional communications follow participation, retention, entitlement and supervision policies without granting World membership.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
