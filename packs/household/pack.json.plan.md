# File plan — `packs/household/pack.json`

**Status:** planned; no product acceptance implied.

Target: `packs/household/pack.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-016](../../docs/specs/spec-016.md).
Tickets: [ZN-0096](../../docs/tickets/zn-0096.md), [ZN-0097](../../docs/tickets/zn-0097.md), [ZN-0098](../../docs/tickets/zn-0098.md), [ZN-0099](../../docs/tickets/zn-0099.md).

## Responsibility and reuse

```text
DATA-ONLY PACK PLAN.
DECLARE stable semantic IDs, typed objects/links, meanings, units, rules, views/actions and dependency closure.
COMPOSE existing kernel operators; no per-customer TypeScript or source credentials in reusable pack data.
COMPILE/evaluate/publish through normal definition governance.
KEEP instance secrets/cursors/private records out of reusable artifacts; rights requests are not grants.
```

## Owning state / operation contracts

### SPEC-016
InstallPack(packDigest,overlay,operationId) -> DefinitionChange; InspectHouseholdObligation(input) -> Frame; InspectBakeryOrder(input) -> Frame; PlanBakeryCapacity(input,basis) -> ReadOnlyPlan.

Pack definitions are canonical JSON: foundation Party, Document, Event, Commitment, Location, Money and Quantity interfaces; household Bill, AccountReference and Obligation; bakery Order, OrderLine, Ingredient, Recipe, InventoryLot, ProductionSlot and Supplier. Instance storage uses shared subject/claim/link models, not one hard-coded SQL table per profession.

[algorithm SPEC-016](../../docs/algorithms/spec-016.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
