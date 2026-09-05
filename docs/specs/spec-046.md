# SPEC-046 — Market data, portfolio analytics and pre-trade risk

**Milestone:** S11 · **Owner:** Finance Domain · **Root:** `packs/finance/analytics`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Quotes, trades, book depth, positions, available cash and settled holdings have distinct semantics. Analytics pin price/FX/corporate-action and model bases. Pre-trade limits are deterministic governed constraints, not an LLM’s confidence or suitability guess.

## Owned state and storage contract
Released objects: Quote, Trade, OrderBookState, Position, CashBalance, Reservation, Portfolio, Benchmark, ValuationPolicy, RiskLimit and RiskObservation. Dense feeds use exact dataset/capture references; portfolio snapshots contain declared account coverage and adjustment/valuation policy.

## Operations

```text
ValuePortfolio(portfolio,priceBasis,fxBasis,policy) -> ValuationFrame; EvaluateRisk(orderIntent,basis,limits) -> Pass|Fail|Unknown; InspectDepth(instrument,feedCut,grant) -> EntitledBook | Gapped; CaptureTradeBasis(ref,maxAge) -> EvidenceRef.
```

## Execution protocol
Market value uses signed exact quantity × contract multiplier × admitted price × explicit FX factor; every term has source/time/unit. Missing price or account coverage returns incomplete/unknown. Corporate adjustments use versioned policy; raw and adjusted histories stay distinct. Advanced stress/sensitivity/risk models are evaluated artifacts with declared assumptions. Risk checks include restricted lists, exposure/reservation fences and current captured market basis.

## Pseudocode and file ownership

[algorithm SPEC-046](../algorithms/spec-046.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0267](../tickets/zn-0267.md) | Implement entitled quotes, trades and order-book depth | component | [ZN-0196](../tickets/zn-0196.md), [ZN-0212](../tickets/zn-0212.md), [ZN-0235](../tickets/zn-0235.md), [ZN-0265](../tickets/zn-0265.md) |
| [ZN-0268](../tickets/zn-0268.md) | Implement positions, balances and reservation-aware availability | component | [ZN-0267](../tickets/zn-0267.md) |
| [ZN-0269](../tickets/zn-0269.md) | Implement reproducible valuation, returns and benchmark basis | component | [ZN-0268](../tickets/zn-0268.md) |
| [ZN-0270](../tickets/zn-0270.md) | Implement pre-trade risk and restricted-list guards | component | [ZN-0269](../tickets/zn-0269.md) |
| [ZN-0271](../tickets/zn-0271.md) | Add evaluated stress and sensitivity analysis profiles | component | [ZN-0270](../tickets/zn-0270.md) |
| [ZN-0272](../tickets/zn-0272.md) | Qualify market-data and risk computation profiles | admission | [ZN-0271](../tickets/zn-0271.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `finance-domain.md`, `data-flows-and-live-data.md`. Read a named historical reference only when needed; it cannot override current contracts.
