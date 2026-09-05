# File plan — `packs/finance/analytics/spec-046/pack.json`

**Status:** planned; no product acceptance implied.

Target: `packs/finance/analytics/spec-046/pack.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-046](../../../../docs/specs/spec-046.md).
Tickets: [ZN-0267](../../../../docs/tickets/zn-0267.md), [ZN-0268](../../../../docs/tickets/zn-0268.md), [ZN-0269](../../../../docs/tickets/zn-0269.md), [ZN-0270](../../../../docs/tickets/zn-0270.md), [ZN-0271](../../../../docs/tickets/zn-0271.md).

## Responsibility and reuse

```text
DATA-ONLY PACK PLAN.
DECLARE stable semantic IDs, typed objects/links, meanings, units, rules, views/actions and dependency closure.
COMPOSE existing kernel operators; no per-customer TypeScript or source credentials in reusable pack data.
COMPILE/evaluate/publish through normal definition governance.
KEEP instance secrets/cursors/private records out of reusable artifacts; rights requests are not grants.
```

## Owning state / operation contracts

### SPEC-046
ValuePortfolio(portfolio,priceBasis,fxBasis,policy) -> ValuationFrame; EvaluateRisk(orderIntent,basis,limits) -> Pass|Fail|Unknown; InspectDepth(instrument,feedCut,grant) -> EntitledBook | Gapped; CaptureTradeBasis(ref,maxAge) -> EvidenceRef.

Released objects: Quote, Trade, OrderBookState, Position, CashBalance, Reservation, Portfolio, Benchmark, ValuationPolicy, RiskLimit and RiskObservation. Dense feeds use exact dataset/capture references; portfolio snapshots contain declared account coverage and adjustment/valuation policy.

[algorithm SPEC-046](../../../../docs/algorithms/spec-046.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
