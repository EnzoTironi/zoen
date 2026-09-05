// @zoen-plan packages/ontology/src/releases/index.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/releases/index.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/releases/index.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-014](../../../../docs/specs/spec-014.md), [SPEC-052](../../../../docs/specs/spec-052.md).
// Tickets: [ZN-0082](../../../../docs/tickets/zn-0082.md), [ZN-0083](../../../../docs/tickets/zn-0083.md), [ZN-0084](../../../../docs/tickets/zn-0084.md), [ZN-0085](../../../../docs/tickets/zn-0085.md), [ZN-0086](../../../../docs/tickets/zn-0086.md), [ZN-0087](../../../../docs/tickets/zn-0087.md), [ZN-0304](../../../../docs/tickets/zn-0304.md).
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
// ### SPEC-014
// ProposeDefinitionChange(base,patch,operationId) -> Change; EvaluateChange(change) -> ReleaseProof; PrepareActivation(change,world) -> PreparedActivation; ApproveChange(change,digest) -> Approval; ActivateRelease(proof,preparation,approval,operationId) -> ActivationReceipt | PreparationStale.
//
// ontology.changes(change_id PK,world_id,base_release,candidate_release,risk,state,author,version); ontology.release_proofs(proof_id PK,release_digest,kernel_image,evaluation_world,cut_digest,report_ref,missing_attestations); ontology.preparations(preparation_id PK,world_id,expected_head,target_release,target_generation,through_cut,open_work_disposition,state); ontology.release_approvals(change_id,principal_id,case_digest PK,policy_basis); ontology.activations(receipt_id PK,world_id,old_head,new_head,proof_ref,preparation_ref). Evaluation namespaces and credentials are separate.
//
// [algorithm SPEC-014](../../../../docs/algorithms/spec-014.md)
//
// ### SPEC-052
// ValidateMiniApp(definition,baseRelease) -> ValidatedManifest|Errors; InstantiateAppTemplate(template,parameters) -> DefinitionChange|InstanceAction; PublishApp(change) -> existing release process; OpenView(session,bindings) -> SemanticCalls through SPEC-050.
//
// MiniAppDefinition closes over appId, pages, approved component registry versions, query/action bindings, form schemas, requested capabilities, resource budget and accessibility labels. It is immutable release content. AppPublicationBinding(appId, manifestDigest, mode, optional artifactDigest, runtimeProfileRef) belongs to the released graph. Drafts remain existing builder_drafts; no mutable runtime latest alias is authority.
//
// [algorithm SPEC-052](../../../../docs/algorithms/spec-052.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
