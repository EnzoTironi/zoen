# File plan — `packs/spec-016/bakery-pack.json`

**Status:** planned; no product acceptance implied.

Target: `packs/spec-016/bakery-pack.json`. Representation: **sidecar-only**. Allocation: **required**.

Specs: [SPEC-016](../../docs/specs/spec-016.md).
Tickets: [ZN-0098](../../docs/tickets/zn-0098.md).

## Responsibility and reuse

```text
PROCEDURE ZN_0098 /* planning label, not a public API */
  OWNER := SPEC-016; TARGET := packs/spec-016/bakery-pack.json
  REQUIRE accepted dependencies: ZN-0097
  REQUIRE evidence layer: component; actual admitted services when needed
  IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
  IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
  USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
    DECLARE foundation/household/bakery meaning as versioned data using existing primitive types.
    SEPARATE money claims, transfer evidence and observed settlement; separate ordered, produced and delivered quantities.
    MODEL units, recipe yield, time windows, capacity and inventory reservations explicitly.
    TYPECHECK pack reference closure and operation schemas through the existing compiler.
    REUSE common claim/identity/authority storage; no per-customer table family or TypeScript branch.
    SEED synthetic test inputs through ordinary admitted operations, not database shortcuts that skip invariants.
    EXPOSE same released operations in conversation, CLI and declarative views under each user's rights.
    KEEP external purchasing/effects disabled until their actual Action/effect gates are admitted.
  TICKET-SPECIFIC SEGMENT:
    01. Define orders, recipes, lots, yields, quantities and delivery commitments.
    02. Add read-only material/capacity plans with exact units and provenance.
    03. Expose instance corrections and proposed purchases through normal Actions, disabled until their runtime capability exists.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN An order changes from 80 to 100 units and flour availability is 1 kg against 1200 g demand
    WHEN The pack computes requirements
    THEN It finds a 200 g shortfall with exact arithmetic; the instance correction does not change every recipe or order
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
