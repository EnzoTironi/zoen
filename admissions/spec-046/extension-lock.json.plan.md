# File plan — `admissions/spec-046/extension-lock.json`

**Status:** planned; no product acceptance implied.

Target: `admissions/spec-046/extension-lock.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-046](../../docs/specs/spec-046.md).
Tickets: [ZN-0271](../../docs/tickets/zn-0271.md).

## Responsibility and reuse

```text
EVIDENCE-REQUIRES-EXECUTION — deliberately no fabricated target artifact.
RUN the actual registry/package-manager/provider/infrastructure qualification for this ticket.
RECORD observed identities, exact versions/integrity, supported API/profile, commands and failed or blocked results.
REQUIRE independent approval and current expiry/scope where applicable.
ONLY produce a lock using the real package manager; only produce a certificate from actual evidence.
NEVER rename this plan into a passing report.
```

## Owning state / operation contracts

### SPEC-046
ValuePortfolio(portfolio,priceBasis,fxBasis,policy) -> ValuationFrame; EvaluateRisk(orderIntent,basis,limits) -> Pass|Fail|Unknown; InspectDepth(instrument,feedCut,grant) -> EntitledBook | Gapped; CaptureTradeBasis(ref,maxAge) -> EvidenceRef.

Released objects: Quote, Trade, OrderBookState, Position, CashBalance, Reservation, Portfolio, Benchmark, ValuationPolicy, RiskLimit and RiskObservation. Dense feeds use exact dataset/capture references; portfolio snapshots contain declared account coverage and adjustment/valuation policy.

[algorithm SPEC-046](../../docs/algorithms/spec-046.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
