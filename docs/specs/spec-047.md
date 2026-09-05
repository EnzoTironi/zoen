# SPEC-047 — Orders, executions, allocations, custody and supervision

**Milestone:** S11 · **Owner:** Finance Domain · **Root:** `packs/finance/execution`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Order submission, broker acknowledgement, execution, allocation, clearing and actual custody settlement are separate lifecycles. Cancellation does not prove no fill occurred. Busts and corrections append evidence and reconcile positions; historical executions are not deleted.

## Owned state and storage contract
Released objects: Order, OrderRevision, BrokerRequest, Execution, ExecutionCorrection, Allocation, ClearingObligation, CustodyMovement, SettlementObservation and SupervisedConversation. Stable provider/account/order/execution IDs are scoped; quantity and fee/currency conservation are checked in normal domain Actions.

## Operations

```text
ProposeOrder(intent,basis) -> RiskBoundActionCase; ObserveBrokerEvent(rawEvidence) -> OrderLifecycleReceipt; AllocateExecution(execution,accounts) -> AllocationCase; ObserveCustody(movementEvidence) -> SettlementReceipt; ReviewCollaboration(space,policy) -> SupervisedView.
```

## Execution protocol
Orders preserve original quantity/terms and replacement/cancel chains. Deduplicate broker event identity. Track ordered, active filled, busted, allocated, cancelled remainder and open quantity with explicit conservation. A 100-unit order filled 40 then busted 10 has active fill 30 and 70 remaining before other events; settlement is a separate observation. Partial/unknown outcomes retain reservations. Professional communications follow participation, retention, entitlement and supervision policies without granting World membership.

## Pseudocode and file ownership

[algorithm SPEC-047](../algorithms/spec-047.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0273](../tickets/zn-0273.md) | Implement order submission and acknowledged lifecycle | component | [ZN-0117](../tickets/zn-0117.md), [ZN-0139](../tickets/zn-0139.md), [ZN-0254](../tickets/zn-0254.md), [ZN-0271](../tickets/zn-0271.md) |
| [ZN-0274](../tickets/zn-0274.md) | Implement executions, corrections and quantity conservation | component | [ZN-0273](../tickets/zn-0273.md) |
| [ZN-0275](../tickets/zn-0275.md) | Handle cancel/replace, partial and fill races | component | [ZN-0274](../tickets/zn-0274.md) |
| [ZN-0276](../tickets/zn-0276.md) | Implement allocations and clearing obligations | component | [ZN-0275](../tickets/zn-0275.md) |
| [ZN-0277](../tickets/zn-0277.md) | Observe actual custody/cash settlement and fails | component | [ZN-0276](../tickets/zn-0276.md) |
| [ZN-0278](../tickets/zn-0278.md) | Implement supervised professional collaboration | component | [ZN-0277](../tickets/zn-0277.md) |
| [ZN-0279](../tickets/zn-0279.md) | Prove full finance lifecycle under adversarial ordering | chaos | [ZN-0278](../tickets/zn-0278.md) |
| [ZN-0280](../tickets/zn-0280.md) | Certify each broker, custodian and regulated operating scope | admission | [ZN-0279](../tickets/zn-0279.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `finance-domain.md`, `actions-effects-and-settlement.md`. Read a named historical reference only when needed; it cannot override current contracts.
