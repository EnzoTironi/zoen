// @zoen-plan packages/clients/src/mcp-apps/index.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/clients/src/mcp-apps/index.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/clients/src/mcp-apps/index.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-035](../../../../docs/specs/spec-035.md).
// Tickets: [ZN-0205](../../../../docs/tickets/zn-0205.md).
//
// ## Responsibility and reuse
//
// ```text
// COMPOSITION/REGISTRATION PLAN.
// IMPORT only reviewed implemented ports and adapters under the existing dependency direction.
// BIND the existing semantic executor once; register this module's released operation descriptors.
// DO NOT add business rules, source credentials, alternate policy evaluators or a second dispatcher here.
// GATE unavailable capabilities explicitly; an unwired implementation does not satisfy a ticket.
// KEEP shared composition edits under the named exclusive lock.
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
