// @zoen-plan apps/authority-worker/src/registrations/spec-013.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `apps/authority-worker/src/registrations/spec-013.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `apps/authority-worker/src/registrations/spec-013.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-013](../../../../docs/specs/spec-013.md).
// Tickets: [ZN-0075](../../../../docs/tickets/zn-0075.md), [ZN-0076](../../../../docs/tickets/zn-0076.md), [ZN-0077](../../../../docs/tickets/zn-0077.md), [ZN-0078](../../../../docs/tickets/zn-0078.md), [ZN-0079](../../../../docs/tickets/zn-0079.md), [ZN-0080](../../../../docs/tickets/zn-0080.md), [ZN-0081](../../../../docs/tickets/zn-0081.md).
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
// ### SPEC-013
// CompileDefinitionGraph(pinnedInputs,kernelAbi) -> WorldRelease | CompilationErrors; SemanticDiff(base,candidate) -> DiffAndImpact; ValidatePlan(plan,bounds) -> TypedPlan | UnsupportedPlan.
//
// ontology.definitions(definition_digest PK,namespace,semantic_id,kind,schema_version,canonical_blob_ref); ontology.releases(release_digest PK,graph_root,surface_manifest_ref,kernel_abi,signature_ref,created_by); ontology.definition_refs(parent_digest,child_digest PK,kind). Per-user secrets and customer records never enter reusable releases.
//
// [algorithm SPEC-013](../../../../docs/algorithms/spec-013.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
