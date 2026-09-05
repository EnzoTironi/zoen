# File plan — `runbooks/spec-016/pack-journey.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-016/pack-journey.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-016](../../docs/specs/spec-016.md).
Tickets: [ZN-0100](../../docs/tickets/zn-0100.md).

## Responsibility and reuse

## ZN-0100 operational/repair procedure

Scope: Prove three-source bakery correction without redeployment. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
The complete learning journey runs
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
DECLARE foundation/household/bakery meaning as versioned data using existing primitive types.
SEPARATE money claims, transfer evidence and observed settlement; separate ordered, produced and delivered quantities.
MODEL units, recipe yield, time windows, capacity and inventory reservations explicitly.
TYPECHECK pack reference closure and operation schemas through the existing compiler.
REUSE common claim/identity/authority storage; no per-customer table family or TypeScript branch.
SEED synthetic test inputs through ordinary admitted operations, not database shortcuts that skip invariants.
EXPOSE same released operations in conversation, CLI and declarative views under each user's rights.
KEEP external purchasing/effects disabled until their actual Action/effect gates are admitted.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
The system selects the amendment only under the rule, retains delivery as a different fact and scopes both changes correctly
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-016
InstallPack(packDigest,overlay,operationId) -> DefinitionChange; InspectHouseholdObligation(input) -> Frame; InspectBakeryOrder(input) -> Frame; PlanBakeryCapacity(input,basis) -> ReadOnlyPlan.

Pack definitions are canonical JSON: foundation Party, Document, Event, Commitment, Location, Money and Quantity interfaces; household Bill, AccountReference and Obligation; bakery Order, OrderLine, Ingredient, Recipe, InventoryLot, ProductionSlot and Supplier. Instance storage uses shared subject/claim/link models, not one hard-coded SQL table per profession.

[algorithm SPEC-016](../../docs/algorithms/spec-016.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
