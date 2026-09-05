# File plan — `packs/finance/execution/spec-047/supervision.json`

**Status:** planned; no product acceptance implied.

Target: `packs/finance/execution/spec-047/supervision.json`. Representation: **sidecar-only**. Allocation: **required**.

Specs: [SPEC-047](../../../../docs/specs/spec-047.md).
Tickets: [ZN-0278](../../../../docs/tickets/zn-0278.md).

## Responsibility and reuse

```text
PROCEDURE ZN_0278 /* planning label, not a public API */
  OWNER := SPEC-047; TARGET := packs/finance/execution/spec-047/supervision.json
  REQUIRE accepted dependencies: ZN-0277
  REQUIRE evidence layer: component; actual admitted services when needed
  IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
  IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
  USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
    FORM order ActionCase with exact account/instrument/side/quantity/price/venue/consequences and pre-trade guards.
    RESERVE limits/funds/inventory atomically with local decision and stable order/effect identity.
    SEND only through current admitted effect permit and actual provider contract; acknowledgement is not fill or settlement.
    RECONCILE fills/corrections/cancel-replace using provider sequence/identity; duplicates cannot double count.
    TREAT partial fills, cancel races, rejected replacements and ambiguous transmission as separate observable states.
    ALLOCATE executed quantities with exact conservation and governed account rights.
    RECORD custody/financial settlement from actual external evidence; disagreement stays a reconciliation case.
    SUPERVISE communications/actions under licensed retention and participation rules without granting World membership.
    REQUIRE real operating/regulatory/provider qualification; never label local test receipts as market execution.
  TICKET-SPECIFIC SEGMENT:
    01. Define conversation participation, licensed sharing, retention/hold and supervisor review policies.
    02. Reauthorize every participant’s disclosed evidence and actions.
    03. Keep chat participation separate from data/action authority.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN A counterparty joins a supervised conversation without World membership
    WHEN A user posts a licensed research excerpt and an order approval request
    THEN Only permitted content is shared and the counterparty gains no implicit data access or approval rights
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
