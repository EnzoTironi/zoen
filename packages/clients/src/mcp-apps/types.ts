// @zoen-plan packages/clients/src/mcp-apps/types.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/clients/src/mcp-apps/types.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/clients/src/mcp-apps/types.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-035](../../../../docs/specs/spec-035.md).
// Tickets: [ZN-0205](../../../../docs/tickets/zn-0205.md).
//
// ## Responsibility and reuse
//
// ```text
// CONTRACT SURFACE PLAN.
// DEFINE only the owning module's input/output/error/state and dependency-port types.
// REUSE branded kernel values, verified context, common semantic envelope and typed results.
// DO NOT export repositories or broad credentials to clients; authority context is server verified.
// SEPARATE versioned semantic meaning from transport metadata and immutable artifacts from mutable runtime state.
// VERIFY consumers use the same contracts and exhaustive tagged outcomes; unsupported shapes fail closed.
// ```
//
// ## Owning state / operation contracts
//
// ### SPEC-035
// EditDraft -> Draft; PreviewApp -> IsolatedPreview; PublishApp -> existing DefinitionChange process. AppBridgeRequest is a transport envelope for SemanticCall, not a domain data API.
//
// MiniAppDefinition is released meaning owned by Ontology. SPEC-052 owns definition/manifest contracts; SPEC-051 owns authority-free links and scoped execution sessions; SPEC-029 owns signed artifacts; SPEC-053 owns non-authoritative bridge/runner state. eve.builder_drafts remains non-authoritative authoring state. No app authority database.
//
// [algorithm SPEC-035](../../../../docs/algorithms/spec-035.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
