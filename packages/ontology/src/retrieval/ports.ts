// @zoen-plan packages/ontology/src/retrieval/ports.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/retrieval/ports.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/retrieval/ports.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-025](../../../../docs/specs/spec-025.md).
// Tickets: [ZN-0147](../../../../docs/tickets/zn-0147.md), [ZN-0148](../../../../docs/tickets/zn-0148.md), [ZN-0149](../../../../docs/tickets/zn-0149.md), [ZN-0150](../../../../docs/tickets/zn-0150.md), [ZN-0151](../../../../docs/tickets/zn-0151.md).
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
// ### SPEC-025
// Search(query,grant,bounds) -> AuthorizedSearchFrame | UnsupportedPlan; RetrieveEvidence(resultRef,freshGrant) -> Evidence; StartSpecializedAgent(definition,parentMandate,task) -> BoundedAgentRun.
//
// ontology.search_documents(document_id PK,world_id,evidence_ref,source_revision,projection_cut,rights_label,text_vector,embedding_ref); ontology.embedding_jobs(job_id PK,source_ref,model_profile,rights_basis,state); ontology.agent_definitions are released data, not unbounded executable loaders. Index records carry deletion/source ACL lineage.
//
// [algorithm SPEC-025](../../../../docs/algorithms/spec-025.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
