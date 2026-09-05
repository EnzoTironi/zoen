# File plan — `packs/finance/reference-data/spec-045/fundamentals.json`

**Status:** planned; no product acceptance implied.

Target: `packs/finance/reference-data/spec-045/fundamentals.json`. Representation: **sidecar-only**. Allocation: **required**.

Specs: [SPEC-045](../../../../docs/specs/spec-045.md).
Tickets: [ZN-0263](../../../../docs/tickets/zn-0263.md).

## Responsibility and reuse

```text
PROCEDURE ZN_0263 /* planning label, not a public API */
  OWNER := SPEC-045; TARGET := packs/finance/reference-data/spec-045/fundamentals.json
  REQUIRE accepted dependencies: ZN-0262
  REQUIRE evidence layer: component; actual admitted services when needed
  IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
  IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
  USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
    DEFINE instruments, listings, issuers and identifier assignments with namespace and validity; ticker is not a universal key.
    ADMIT licensed source observations as claims/datasets with explicit display/redistribution/model-use rights.
    RESOLVE instrument candidates at requested identity and knowledge cuts; ambiguity remains visible.
    MODEL corporate-action announcement/ex/record/pay dates, elections, quantities and revision lineage independently.
    QUERY fundamentals/news at explicit as-of and known-at cuts; later restatements cannot leak into earlier history.
    APPLY identity/corporate-action corrections through scoped governed changes with dependent recomputation.
    RETURN licensed evidence references rather than unauthorized copied source content.
    QUALIFY actual data licenses/providers before enabling access; architecture supplies no commercial entitlement.
  TICKET-SPECIFIC SEGMENT:
    01. Map filing/reporting-period/metric/consolidation/currency semantics explicitly.
    02. Distinguish reporting valid period from when information became known.
    03. Enforce licensed storage/display/analysis rights on raw and derived data.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN A restatement arrives months after the original filing
    WHEN A historical backtest requests the original knowledge cut
    THEN It receives only then-known data; later revisions are excluded unless the analysis is explicitly restated
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
