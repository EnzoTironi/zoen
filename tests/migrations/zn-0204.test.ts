// @zoen-plan tests/migrations/zn-0204.test.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `tests/migrations/zn-0204.test.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `tests/migrations/zn-0204.test.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-035](../../docs/specs/spec-035.md).
// Tickets: [ZN-0204](../../docs/tickets/zn-0204.md).
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
// ### SPEC-035
// EditDraft -> Draft; PreviewApp -> IsolatedPreview; PublishApp -> existing DefinitionChange process. AppBridgeRequest is a transport envelope for SemanticCall, not a domain data API.
//
// MiniAppDefinition is released meaning owned by Ontology. SPEC-052 owns definition/manifest contracts; SPEC-051 owns authority-free links and scoped execution sessions; SPEC-029 owns signed artifacts; SPEC-053 owns non-authoritative bridge/runner state. eve.builder_drafts remains non-authoritative authoring state. No app authority database.
//
// [algorithm SPEC-035](../../docs/algorithms/spec-035.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
