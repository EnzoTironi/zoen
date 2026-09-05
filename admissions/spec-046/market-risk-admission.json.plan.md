# File plan — `admissions/spec-046/market-risk-admission.json`

**Status:** planned; no product acceptance implied.

Target: `admissions/spec-046/market-risk-admission.json`. Representation: **sidecar-only**. Allocation: **required**.

Specs: [SPEC-046](../../docs/specs/spec-046.md).
Tickets: [ZN-0272](../../docs/tickets/zn-0272.md).

## Responsibility and reuse

```text
PROCEDURE ZN_0272 /* planning label, not a public API */
  OWNER := SPEC-046; TARGET := admissions/spec-046/market-risk-admission.json
  REQUIRE accepted dependencies: ZN-0271
  REQUIRE evidence layer: admission; actual admitted services when needed
  IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
  IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
  USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
    OPEN entitled instrument/position/price/curve versions with gap, freshness and temporal basis.
    RECONCILE positions and corporate-action effects; separate observations from inferred valuation/model outputs.
    CALCULATE exact quantities/money using released valuation conventions and evaluated models; expose uncertainty and missing inputs.
    CAPTURE exact live observations before they affect a consequential Case.
    EVALUATE pre-trade constraints over current positions, pending orders and reserved resources, including absent-row predicates.
    PIN risk result, model version, limits, source cuts and expiry in the proposed order's guards.
    RECHECK at final commit; changed market/position/limit state returns Stale rather than silently repricing consent.
    ADMIT actual market feeds/model/venue profile and measured latency; no invented executable quote or risk certification.
  TICKET-SPECIFIC SEGMENT:
    01. Exercise actual feed sequencing/entitlements and independently verified calculation fixtures.
    02. Review asset-class, region, venue and risk-model support boundaries.
    03. Keep unsupported instruments/model scopes blocked.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN One asset-class/feed profile is qualified but another is only schema-compatible
    WHEN The second is requested for trading
    THEN It remains unadmitted until its source and numerical/risk contracts are proved
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
