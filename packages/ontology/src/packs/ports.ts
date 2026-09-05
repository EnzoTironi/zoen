// @zoen-plan packages/ontology/src/packs/ports.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/packs/ports.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/packs/ports.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-037](../../../../docs/specs/spec-037.md).
// Tickets: [ZN-0213](../../../../docs/tickets/zn-0213.md), [ZN-0214](../../../../docs/tickets/zn-0214.md), [ZN-0215](../../../../docs/tickets/zn-0215.md), [ZN-0216](../../../../docs/tickets/zn-0216.md).
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
// ### SPEC-037
// ResolvePackGraph(request,pinnedBase) -> LockedGraph; InstallPack(graph,overlay) -> Change; UpgradePack(install,target) -> SemanticDiff; RemovePack(install) -> DispositionPlan; VerifyPublisher(signature) -> VerifiedOrigin | Denied.
//
// ontology.pack_versions(pack_digest PK,publisher,namespace,version,dependencies,requested_capabilities,artifact_refs,signature_ref,license_ref); ontology.pack_installs(install_id PK,world_id,pack_digest,overlay_ref,granted_scope,state); ontology.publisher_records(publisher_id PK,verified_identity,signing_keys,review_state); ontology.marketplace_entitlements(entitlement_id PK,world_id,pack_ref,terms_version,state). No publisher can query installed customer data by default.
//
// [algorithm SPEC-037](../../../../docs/algorithms/spec-037.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
