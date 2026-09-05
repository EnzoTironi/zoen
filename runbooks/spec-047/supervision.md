# File plan — `runbooks/spec-047/supervision.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-047/supervision.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-047](../../docs/specs/spec-047.md).
Tickets: [ZN-0278](../../docs/tickets/zn-0278.md).

## Responsibility and reuse

## ZN-0278 operational/repair procedure

Scope: Implement supervised professional collaboration. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
A user posts a licensed research excerpt and an order approval request
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
FORM order ActionCase with exact account/instrument/side/quantity/price/venue/consequences and pre-trade guards.
RESERVE limits/funds/inventory atomically with local decision and stable order/effect identity.
SEND only through current admitted effect permit and actual provider contract; acknowledgement is not fill or settlement.
RECONCILE fills/corrections/cancel-replace using provider sequence/identity; duplicates cannot double count.
TREAT partial fills, cancel races, rejected replacements and ambiguous transmission as separate observable states.
ALLOCATE executed quantities with exact conservation and governed account rights.
RECORD custody/financial settlement from actual external evidence; disagreement stays a reconciliation case.
SUPERVISE communications/actions under licensed retention and participation rules without granting World membership.
REQUIRE real operating/regulatory/provider qualification; never label local test receipts as market execution.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
Only permitted content is shared and the counterparty gains no implicit data access or approval rights
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-047
ProposeOrder(intent,basis) -> RiskBoundActionCase; ObserveBrokerEvent(rawEvidence) -> OrderLifecycleReceipt; AllocateExecution(execution,accounts) -> AllocationCase; ObserveCustody(movementEvidence) -> SettlementReceipt; ReviewCollaboration(space,policy) -> SupervisedView.

Released objects: Order, OrderRevision, BrokerRequest, Execution, ExecutionCorrection, Allocation, ClearingObligation, CustodyMovement, SettlementObservation and SupervisedConversation. Stable provider/account/order/execution IDs are scoped; quantity and fee/currency conservation are checked in normal domain Actions.

[algorithm SPEC-047](../../docs/algorithms/spec-047.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
