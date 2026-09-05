// @zoen-plan tests/migrations/zn-0147.test.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `tests/migrations/zn-0147.test.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `tests/migrations/zn-0147.test.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-025](../../docs/specs/spec-025.md).
// Tickets: [ZN-0147](../../docs/tickets/zn-0147.md).
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
// ### SPEC-025
// Search(query,grant,bounds) -> AuthorizedSearchFrame | UnsupportedPlan; RetrieveEvidence(resultRef,freshGrant) -> Evidence; StartSpecializedAgent(definition,parentMandate,task) -> BoundedAgentRun.
//
// ontology.search_documents(document_id PK,world_id,evidence_ref,source_revision,projection_cut,rights_label,text_vector,embedding_ref); ontology.embedding_jobs(job_id PK,source_ref,model_profile,rights_basis,state); ontology.agent_definitions are released data, not unbounded executable loaders. Index records carry deletion/source ACL lineage.
//
// [algorithm SPEC-025](../../docs/algorithms/spec-025.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
