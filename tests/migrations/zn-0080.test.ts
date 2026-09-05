// @zoen-plan tests/migrations/zn-0080.test.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `tests/migrations/zn-0080.test.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `tests/migrations/zn-0080.test.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-013](../../docs/specs/spec-013.md).
// Tickets: [ZN-0080](../../docs/tickets/zn-0080.md).
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
// ### SPEC-013
// CompileDefinitionGraph(pinnedInputs,kernelAbi) -> WorldRelease | CompilationErrors; SemanticDiff(base,candidate) -> DiffAndImpact; ValidatePlan(plan,bounds) -> TypedPlan | UnsupportedPlan.
//
// ontology.definitions(definition_digest PK,namespace,semantic_id,kind,schema_version,canonical_blob_ref); ontology.releases(release_digest PK,graph_root,surface_manifest_ref,kernel_abi,signature_ref,created_by); ontology.definition_refs(parent_digest,child_digest PK,kind). Per-user secrets and customer records never enter reusable releases.
//
// [algorithm SPEC-013](../../docs/algorithms/spec-013.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
