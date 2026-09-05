// @zoen-plan tests/migrations/zn-0096.test.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `tests/migrations/zn-0096.test.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `tests/migrations/zn-0096.test.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-016](../../docs/specs/spec-016.md).
// Tickets: [ZN-0096](../../docs/tickets/zn-0096.md).
//
// ## Responsibility and reuse
//
// ```text
// CONDITIONAL SUPPORT SEGMENT.
// FIRST prove this file is needed by an owning ticket; do not implement parallel abstractions merely to fill paths.
// READ the current implementation and shared module algorithm; select only the missing support responsibility.
// KEEP dependency direction and single authority ownership; no provider success stub or ambient credential.
// WIRE into the owning ticket's declared entry and prove its exact tests.
// ```
//
// ## Owning state / operation contracts
//
// ### SPEC-016
// InstallPack(packDigest,overlay,operationId) -> DefinitionChange; InspectHouseholdObligation(input) -> Frame; InspectBakeryOrder(input) -> Frame; PlanBakeryCapacity(input,basis) -> ReadOnlyPlan.
//
// Pack definitions are canonical JSON: foundation Party, Document, Event, Commitment, Location, Money and Quantity interfaces; household Bill, AccountReference and Obligation; bakery Order, OrderLine, Ingredient, Recipe, InventoryLot, ProductionSlot and Supplier. Instance storage uses shared subject/claim/link models, not one hard-coded SQL table per profession.
//
// [algorithm SPEC-016](../../docs/algorithms/spec-016.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
