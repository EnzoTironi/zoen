# File plan — `packs/finance/execution/spec-047/pack.json`

**Status:** planned; no product acceptance implied.

Target: `packs/finance/execution/spec-047/pack.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-047](../../../../docs/specs/spec-047.md).
Tickets: [ZN-0273](../../../../docs/tickets/zn-0273.md), [ZN-0274](../../../../docs/tickets/zn-0274.md), [ZN-0275](../../../../docs/tickets/zn-0275.md), [ZN-0276](../../../../docs/tickets/zn-0276.md), [ZN-0277](../../../../docs/tickets/zn-0277.md), [ZN-0278](../../../../docs/tickets/zn-0278.md).

## Responsibility and reuse

```text
DATA-ONLY PACK PLAN.
DECLARE stable semantic IDs, typed objects/links, meanings, units, rules, views/actions and dependency closure.
COMPOSE existing kernel operators; no per-customer TypeScript or source credentials in reusable pack data.
COMPILE/evaluate/publish through normal definition governance.
KEEP instance secrets/cursors/private records out of reusable artifacts; rights requests are not grants.
```

## Owning state / operation contracts

### SPEC-047
ProposeOrder(intent,basis) -> RiskBoundActionCase; ObserveBrokerEvent(rawEvidence) -> OrderLifecycleReceipt; AllocateExecution(execution,accounts) -> AllocationCase; ObserveCustody(movementEvidence) -> SettlementReceipt; ReviewCollaboration(space,policy) -> SupervisedView.

Released objects: Order, OrderRevision, BrokerRequest, Execution, ExecutionCorrection, Allocation, ClearingObligation, CustodyMovement, SettlementObservation and SupervisedConversation. Stable provider/account/order/execution IDs are scoped; quantity and fee/currency conservation are checked in normal domain Actions.

[algorithm SPEC-047](../../../../docs/algorithms/spec-047.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
