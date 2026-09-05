// @zoen-plan apps/web/src/living-world/index.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `apps/web/src/living-world/index.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `apps/web/src/living-world/index.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-027](../../../../docs/specs/spec-027.md).
// Tickets: [ZN-0159](../../../../docs/tickets/zn-0159.md), [ZN-0162](../../../../docs/tickets/zn-0162.md).
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
// ### SPEC-027
// OpenFocus(focus,freshGrant) -> Historical|Newer|UnavailableView; RenderChart(chartDocument,frame) -> AccessibleView; ExportView(frame,format,destination) -> AuthorizedExportCase.
//
// Presentation definitions: ViewDefinition, ChartDocument, TableDefinition and FocusLens. Instance preferences remain Eve-owned data. Frame/Focus refs are opaque; browser caches include current principal/World/security revision and are discarded on logout/rebind.
//
// [algorithm SPEC-027](../../../../docs/algorithms/spec-027.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
