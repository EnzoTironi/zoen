// @zoen-plan apps/web/src/routes.tsx
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `apps/web/src/routes.tsx`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `apps/web/src/routes.tsx`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-027](../../../docs/specs/spec-027.md), [SPEC-035](../../../docs/specs/spec-035.md), [SPEC-051](../../../docs/specs/spec-051.md), [SPEC-052](../../../docs/specs/spec-052.md).
// Tickets: [ZN-0159](../../../docs/tickets/zn-0159.md), [ZN-0162](../../../docs/tickets/zn-0162.md), [ZN-0203](../../../docs/tickets/zn-0203.md), [ZN-0204](../../../docs/tickets/zn-0204.md), [ZN-0297](../../../docs/tickets/zn-0297.md), [ZN-0300](../../../docs/tickets/zn-0300.md), [ZN-0306](../../../docs/tickets/zn-0306.md).
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
// ### SPEC-027
// OpenFocus(focus,freshGrant) -> Historical|Newer|UnavailableView; RenderChart(chartDocument,frame) -> AccessibleView; ExportView(frame,format,destination) -> AuthorizedExportCase.
//
// Presentation definitions: ViewDefinition, ChartDocument, TableDefinition and FocusLens. Instance preferences remain Eve-owned data. Frame/Focus refs are opaque; browser caches include current principal/World/security revision and are discarded on logout/rebind.
//
// [algorithm SPEC-027](../../../docs/algorithms/spec-027.md)
//
// ### SPEC-035
// EditDraft -> Draft; PreviewApp -> IsolatedPreview; PublishApp -> existing DefinitionChange process. AppBridgeRequest is a transport envelope for SemanticCall, not a domain data API.
//
// MiniAppDefinition is released meaning owned by Ontology. SPEC-052 owns definition/manifest contracts; SPEC-051 owns authority-free links and scoped execution sessions; SPEC-029 owns signed artifacts; SPEC-053 owns non-authoritative bridge/runner state. eve.builder_drafts remains non-authoritative authoring state. No app authority database.
//
// [algorithm SPEC-035](../../../docs/algorithms/spec-035.md)
//
// ### SPEC-051
// CreateContinuation(target,scope,recipient?,expiry?,operationId) -> LinkRef; ResolveContinuation(ref) -> GenericLanding|AuthorizedTarget; OpenApp(ref,verifiedPresence) -> AppSession|Denied; RevokeContinuation(ref) -> Receipt; RevokeAppSession(ref) -> Receipt.
//
// ontology.continuations(link_ref PK,world_id,realm,focus_ref,target_kind,target_ref,version_policy,recipient_constraint_nullable,expires_at_nullable,state,creator,created_receipt); target_kind=focus|app. ontology.app_sessions(session_ref PK,world_id,realm,principal,actor,installation_ref_nullable,publication_binding,scope_digest,purpose,assurance,security_revision,expires_at,state). Relationships/World grants remain existing ontology records. Opaque handles have at least 192 random bits; logs are redacted. Door owns browser challenge records, not app business permissions.
//
// [algorithm SPEC-051](../../../docs/algorithms/spec-051.md)
//
// ### SPEC-052
// ValidateMiniApp(definition,baseRelease) -> ValidatedManifest|Errors; InstantiateAppTemplate(template,parameters) -> DefinitionChange|InstanceAction; PublishApp(change) -> existing release process; OpenView(session,bindings) -> SemanticCalls through SPEC-050.
//
// MiniAppDefinition closes over appId, pages, approved component registry versions, query/action bindings, form schemas, requested capabilities, resource budget and accessibility labels. It is immutable release content. AppPublicationBinding(appId, manifestDigest, mode, optional artifactDigest, runtimeProfileRef) belongs to the released graph. Drafts remain existing builder_drafts; no mutable runtime latest alias is authority.
//
// [algorithm SPEC-052](../../../docs/algorithms/spec-052.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
