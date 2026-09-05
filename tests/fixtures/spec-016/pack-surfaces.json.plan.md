# File plan — `tests/fixtures/spec-016/pack-surfaces.json`

**Status:** planned; no product acceptance implied.

Target: `tests/fixtures/spec-016/pack-surfaces.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-016](../../../docs/specs/spec-016.md).
Tickets: [ZN-0099](../../../docs/tickets/zn-0099.md).

## Responsibility and reuse

```text
CONDITIONAL INPUT FIXTURE PLAN — not an observed service result.
USE synthetic records within owned disposable namespaces and explicit valid/knowledge time.
INCLUDE comparable rivals, a denied source, duplicate provenance family and stale dependency when in scope.
COMPUTE fixed expected values from the owning oracle, not from the implementation under test.
LOAD through the real component/journey boundary; do not replace provider/database behavior with this file.
VERSION seed, units, rights and cleanup scope.
```

## Owning state / operation contracts

### SPEC-016
InstallPack(packDigest,overlay,operationId) -> DefinitionChange; InspectHouseholdObligation(input) -> Frame; InspectBakeryOrder(input) -> Frame; PlanBakeryCapacity(input,basis) -> ReadOnlyPlan.

Pack definitions are canonical JSON: foundation Party, Document, Event, Commitment, Location, Money and Quantity interfaces; household Bill, AccountReference and Obligation; bakery Order, OrderLine, Ingredient, Recipe, InventoryLot, ProductionSlot and Supplier. Instance storage uses shared subject/claim/link models, not one hard-coded SQL table per profession.

[algorithm SPEC-016](../../../docs/algorithms/spec-016.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
