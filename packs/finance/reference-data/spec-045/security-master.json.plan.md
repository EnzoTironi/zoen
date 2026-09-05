# File plan — `packs/finance/reference-data/spec-045/security-master.json`

**Status:** planned; no product acceptance implied.

Target: `packs/finance/reference-data/spec-045/security-master.json`. Representation: **sidecar-only**. Allocation: **required**.

Specs: [SPEC-045](../../../../docs/specs/spec-045.md).
Tickets: [ZN-0261](../../../../docs/tickets/zn-0261.md).

## Responsibility and reuse

```text
PROCEDURE ZN_0261 /* planning label, not a public API */
  OWNER := SPEC-045; TARGET := packs/finance/reference-data/spec-045/security-master.json
  REQUIRE accepted dependencies: ZN-0218, ZN-0244, ZN-0254
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
    01. Author explicit namespaces, temporal identifier assignments and source mappings.
    02. Reuse guarded identity resolution with reversible merge/split.
    03. Keep ticker/listing collisions and issuer relationships distinct.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN The same ticker exists on two venues and an identifier changes after a corporate event
    WHEN Instrument resolution runs
    THEN It returns the correct qualified identity or ambiguity, never a global ticker-based merge
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
