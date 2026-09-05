# File plan — `runbooks/spec-046/risk-models.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-046/risk-models.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-046](../../docs/specs/spec-046.md).
Tickets: [ZN-0271](../../docs/tickets/zn-0271.md).

## Responsibility and reuse

## ZN-0271 operational/repair procedure

Scope: Add evaluated stress and sensitivity analysis profiles. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
An agent recommends execution
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
OPEN entitled instrument/position/price/curve versions with gap, freshness and temporal basis.
RECONCILE positions and corporate-action effects; separate observations from inferred valuation/model outputs.
CALCULATE exact quantities/money using released valuation conventions and evaluated models; expose uncertainty and missing inputs.
CAPTURE exact live observations before they affect a consequential Case.
EVALUATE pre-trade constraints over current positions, pending orders and reserved resources, including absent-row predicates.
PIN risk result, model version, limits, source cuts and expiry in the proposed order's guards.
RECHECK at final commit; changed market/position/limit state returns Stale rather than silently repricing consent.
ADMIT actual market feeds/model/venue profile and measured latency; no invented executable quote or risk certification.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
The analysis is labeled hypothetical/incomplete and cannot bypass the live risk/approval protocol
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-046
ValuePortfolio(portfolio,priceBasis,fxBasis,policy) -> ValuationFrame; EvaluateRisk(orderIntent,basis,limits) -> Pass|Fail|Unknown; InspectDepth(instrument,feedCut,grant) -> EntitledBook | Gapped; CaptureTradeBasis(ref,maxAge) -> EvidenceRef.

Released objects: Quote, Trade, OrderBookState, Position, CashBalance, Reservation, Portfolio, Benchmark, ValuationPolicy, RiskLimit and RiskObservation. Dense feeds use exact dataset/capture references; portfolio snapshots contain declared account coverage and adjustment/valuation policy.

[algorithm SPEC-046](../../docs/algorithms/spec-046.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
