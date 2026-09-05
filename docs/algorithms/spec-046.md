# SPEC-046 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-046](../specs/spec-046.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Finance Domain**. Module: `packs/finance/analytics`. Milestone: **S11**.

## Normative operation signatures

```text
ValuePortfolio(portfolio,priceBasis,fxBasis,policy) -> ValuationFrame; EvaluateRisk(orderIntent,basis,limits) -> Pass|Fail|Unknown; InspectDepth(instrument,feedCut,grant) -> EntitledBook | Gapped; CaptureTradeBasis(ref,maxAge) -> EvidenceRef.
```

## State and transaction contract

Released objects: Quote, Trade, OrderBookState, Position, CashBalance, Reservation, Portfolio, Benchmark, ValuationPolicy, RiskLimit and RiskObservation. Dense feeds use exact dataset/capture references; portfolio snapshots contain declared account coverage and adjustment/valuation policy.

## Shared algorithm

```text
OPEN entitled instrument/position/price/curve versions with gap, freshness and temporal basis.
RECONCILE positions and corporate-action effects; separate observations from inferred valuation/model outputs.
CALCULATE exact quantities/money using released valuation conventions and evaluated models; expose uncertainty and missing inputs.
CAPTURE exact live observations before they affect a consequential Case.
EVALUATE pre-trade constraints over current positions, pending orders and reserved resources, including absent-row predicates.
PIN risk result, model version, limits, source cuts and expiry in the proposed order's guards.
RECHECK at final commit; changed market/position/limit state returns Stale rather than silently repricing consent.
ADMIT actual market feeds/model/venue profile and measured latency; no invented executable quote or risk certification.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0267](../tickets/zn-0267.md) | Implement entitled quotes, trades and order-book depth | [packs/finance/analytics/spec-046/market-data-pack.json](../../packs/finance/analytics/spec-046/market-data-pack.json.plan.md) |
| [ZN-0268](../tickets/zn-0268.md) | Implement positions, balances and reservation-aware availability | [packs/finance/analytics/spec-046/positions.json](../../packs/finance/analytics/spec-046/positions.json.plan.md) |
| [ZN-0269](../tickets/zn-0269.md) | Implement reproducible valuation, returns and benchmark basis | [packs/finance/analytics/spec-046/valuation.json](../../packs/finance/analytics/spec-046/valuation.json.plan.md) |
| [ZN-0270](../tickets/zn-0270.md) | Implement pre-trade risk and restricted-list guards | [packs/finance/analytics/spec-046/pretrade-risk.json](../../packs/finance/analytics/spec-046/pretrade-risk.json.plan.md) |
| [ZN-0271](../tickets/zn-0271.md) | Add evaluated stress and sensitivity analysis profiles | [packs/finance/analytics/spec-046/risk-models.json](../../packs/finance/analytics/spec-046/risk-models.json.plan.md) |
| [ZN-0272](../tickets/zn-0272.md) | Qualify market-data and risk computation profiles | [admissions/spec-046/market-risk-admission.json](../../admissions/spec-046/market-risk-admission.json.plan.md) |

## Required proof boundaries

Market value uses signed exact quantity × contract multiplier × admitted price × explicit FX factor; every term has source/time/unit. Missing price or account coverage returns incomplete/unknown. Corporate adjustments use versioned policy; raw and adjusted histories stay distinct. Advanced stress/sensitivity/risk models are evaluated artifacts with declared assumptions. Risk checks include restricted lists, exposure/reservation fences and current captured market basis.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
