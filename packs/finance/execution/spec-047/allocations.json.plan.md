# File plan — `packs/finance/execution/spec-047/allocations.json`

**Status:** planned; no product acceptance implied.

Target: `packs/finance/execution/spec-047/allocations.json`. Representation: **sidecar-only**. Allocation: **required**.

Specs: [SPEC-047](../../../../docs/specs/spec-047.md).
Tickets: [ZN-0276](../../../../docs/tickets/zn-0276.md).

## Responsibility and reuse

```text
PROCEDURE ZN_0276 /* planning label, not a public API */
  OWNER := SPEC-047; TARGET := packs/finance/execution/spec-047/allocations.json
  REQUIRE accepted dependencies: ZN-0275
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
    01. Allocate active execution quantities to authorized accounts under exact sum constraints.
    02. Preserve fees, currencies, account identity and allocation rejection/correction.
    03. Create clearing obligations without labeling them settled custody.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN Only part of an execution’s allocation is accepted
    WHEN The allocation workflow completes its first response
    THEN The result is partial and unallocated exposure remains explicit; no entire-trade settlement is inferred
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
