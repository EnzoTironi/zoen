# File plan — `tests/fixtures/spec-047/allocations.json`

**Status:** planned; no product acceptance implied.

Target: `tests/fixtures/spec-047/allocations.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-047](../../../docs/specs/spec-047.md).
Tickets: [ZN-0276](../../../docs/tickets/zn-0276.md).

## Responsibility and reuse

```text
CONDITIONAL INPUT FIXTURE PLAN — not an observed service result.
USE synthetic records within owned disposable namespaces and explicit valid/knowledge time.
INCLUDE comparable rivals, a denied source, duplicate provenance family and stale dependency when in scope.
COMPUTE fixed expected values from the owning oracle, not from the implementation under test.
LOAD through the real component/journey boundary; do not replace provider/database behavior with this file.
VERSION seed, units, rights and cleanup scope.
```

## Owning state / operation contracts

### SPEC-047
ProposeOrder(intent,basis) -> RiskBoundActionCase; ObserveBrokerEvent(rawEvidence) -> OrderLifecycleReceipt; AllocateExecution(execution,accounts) -> AllocationCase; ObserveCustody(movementEvidence) -> SettlementReceipt; ReviewCollaboration(space,policy) -> SupervisedView.

Released objects: Order, OrderRevision, BrokerRequest, Execution, ExecutionCorrection, Allocation, ClearingObligation, CustodyMovement, SettlementObservation and SupervisedConversation. Stable provider/account/order/execution IDs are scoped; quantity and fee/currency conservation are checked in normal domain Actions.

[algorithm SPEC-047](../../../docs/algorithms/spec-047.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
