# SPEC-016 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-016](../specs/spec-016.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Domain Product**. Module: `packs`. Milestone: **S2**.

## Normative operation signatures

```text
InstallPack(packDigest,overlay,operationId) -> DefinitionChange; InspectHouseholdObligation(input) -> Frame; InspectBakeryOrder(input) -> Frame; PlanBakeryCapacity(input,basis) -> ReadOnlyPlan.
```

## State and transaction contract

Pack definitions are canonical JSON: foundation Party, Document, Event, Commitment, Location, Money and Quantity interfaces; household Bill, AccountReference and Obligation; bakery Order, OrderLine, Ingredient, Recipe, InventoryLot, ProductionSlot and Supplier. Instance storage uses shared subject/claim/link models, not one hard-coded SQL table per profession.

## Shared algorithm

```text
DECLARE foundation/household/bakery meaning as versioned data using existing primitive types.
SEPARATE money claims, transfer evidence and observed settlement; separate ordered, produced and delivered quantities.
MODEL units, recipe yield, time windows, capacity and inventory reservations explicitly.
TYPECHECK pack reference closure and operation schemas through the existing compiler.
REUSE common claim/identity/authority storage; no per-customer table family or TypeScript branch.
SEED synthetic test inputs through ordinary admitted operations, not database shortcuts that skip invariants.
EXPOSE same released operations in conversation, CLI and declarative views under each user's rights.
KEEP external purchasing/effects disabled until their actual Action/effect gates are admitted.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0096](../tickets/zn-0096.md) | Define foundation interfaces and cross-pack mappings | [packs/spec-016/foundation-pack.json](../../packs/spec-016/foundation-pack.json.plan.md) |
| [ZN-0097](../tickets/zn-0097.md) | Build the household obligations pack | [packs/spec-016/household-pack.json](../../packs/spec-016/household-pack.json.plan.md) |
| [ZN-0098](../tickets/zn-0098.md) | Build confectionery orders and inventory pack | [packs/spec-016/bakery-pack.json](../../packs/spec-016/bakery-pack.json.plan.md) |
| [ZN-0099](../tickets/zn-0099.md) | Generate audience-appropriate surfaces from one pack | [packs/spec-016/pack-surfaces.json](../../packs/spec-016/pack-surfaces.json.plan.md) |
| [ZN-0100](../tickets/zn-0100.md) | Prove three-source bakery correction without redeployment | [tests/journey/spec-016/pack-journey.test.ts](../../tests/journey/spec-016/pack-journey.test.ts) |

## Required proof boundaries

Household paid status distinguishes claim, transfer evidence and settlement. Bakery order quantity, produced quantity and delivered quantity are separate predicates; mass/unit conversions are explicit. Capacity accounts for time windows, yield and reserved inputs. A proposed order or recipe mutation is a governed local Action; external purchasing is disabled until S4.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
