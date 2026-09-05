# SPEC-016 — Foundation, household and confectionery domain packs

**Milestone:** S2 · **Owner:** Domain Product · **Root:** `packs`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
One foundation grammar supports all audiences through release data. No customer/profession branches enter the kernel. Early pack actions requiring S4 are visible as unavailable until the normal action/effect capability is admitted, not implemented through shortcuts.

## Owned state and storage contract
Pack definitions are canonical JSON: foundation Party, Document, Event, Commitment, Location, Money and Quantity interfaces; household Bill, AccountReference and Obligation; bakery Order, OrderLine, Ingredient, Recipe, InventoryLot, ProductionSlot and Supplier. Instance storage uses shared subject/claim/link models, not one hard-coded SQL table per profession.

## Operations

```text
InstallPack(packDigest,overlay,operationId) -> DefinitionChange; InspectHouseholdObligation(input) -> Frame; InspectBakeryOrder(input) -> Frame; PlanBakeryCapacity(input,basis) -> ReadOnlyPlan.
```

## Execution protocol
Household paid status distinguishes claim, transfer evidence and settlement. Bakery order quantity, produced quantity and delivered quantity are separate predicates; mass/unit conversions are explicit. Capacity accounts for time windows, yield and reserved inputs. A proposed order or recipe mutation is a governed local Action; external purchasing is disabled until S4.

## Pseudocode and file ownership

[algorithm SPEC-016](../algorithms/spec-016.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0096](../tickets/zn-0096.md) | Define foundation interfaces and cross-pack mappings | component | [ZN-0081](../tickets/zn-0081.md), [ZN-0088](../tickets/zn-0088.md), [ZN-0094](../tickets/zn-0094.md) |
| [ZN-0097](../tickets/zn-0097.md) | Build the household obligations pack | component | [ZN-0096](../tickets/zn-0096.md) |
| [ZN-0098](../tickets/zn-0098.md) | Build confectionery orders and inventory pack | component | [ZN-0097](../tickets/zn-0097.md) |
| [ZN-0099](../tickets/zn-0099.md) | Generate audience-appropriate surfaces from one pack | component | [ZN-0098](../tickets/zn-0098.md) |
| [ZN-0100](../tickets/zn-0100.md) | Prove three-source bakery correction without redeployment | journey | [ZN-0099](../tickets/zn-0099.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `domain-packs-and-marketplace.md`, `ontology-and-standards.md`. Read a named historical reference only when needed; it cannot override current contracts.
