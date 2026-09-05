# File plan — `packs/finance/reference-data/spec-045/corporate-actions.json`

**Status:** planned; no product acceptance implied.

Target: `packs/finance/reference-data/spec-045/corporate-actions.json`. Representation: **sidecar-only**. Allocation: **required**.

Specs: [SPEC-045](../../../../docs/specs/spec-045.md).
Tickets: [ZN-0262](../../../../docs/tickets/zn-0262.md).

## Responsibility and reuse

```text
PROCEDURE ZN_0262 /* planning label, not a public API */
  OWNER := SPEC-045; TARGET := packs/finance/reference-data/spec-045/corporate-actions.json
  REQUIRE accepted dependencies: ZN-0261
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
    01. Define event kind, announcement/ex/record/pay dates, options/elections and adjustment policy.
    02. Preserve corrections/cancellations and source evidence.
    03. Invalidate affected positions/analytics without rewriting prior observations.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN A split ratio is corrected after the initial announcement
    WHEN Both revisions are admitted
    THEN Historical cuts retain the earlier announcement; current calculations use the approved revised event with lineage
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
