# File plan — `packs/finance/execution/spec-047/custody-settlement.json`

**Status:** planned; no product acceptance implied.

Target: `packs/finance/execution/spec-047/custody-settlement.json`. Representation: **sidecar-only**. Allocation: **required**.

Specs: [SPEC-047](../../../../docs/specs/spec-047.md).
Tickets: [ZN-0277](../../../../docs/tickets/zn-0277.md).

## Responsibility and reuse

```text
PROCEDURE ZN_0277 /* planning label, not a public API */
  OWNER := SPEC-047; TARGET := packs/finance/execution/spec-047/custody-settlement.json
  REQUIRE accepted dependencies: ZN-0276
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
    01. Admit independent custodian/bank movement evidence and reconcile with obligations.
    02. Distinguish contractual settlement date, actual partial delivery, fails and corrections.
    03. Release reservations only according to observed/policy-approved lifecycle.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN An order is filled and allocated but the custodian reports a settlement fail
    WHEN Portfolio and user status refresh
    THEN Filled/allocated state persists while actual settlement remains failed/pending; the product does not report custody complete
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
