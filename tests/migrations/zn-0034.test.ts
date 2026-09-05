// @zoen-plan tests/migrations/zn-0034.test.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `tests/migrations/zn-0034.test.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `tests/migrations/zn-0034.test.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-005](../../docs/specs/spec-005.md).
// Tickets: [ZN-0034](../../docs/tickets/zn-0034.md).
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
// ### SPEC-005
// CompareClaims(claims,meaningProfile) -> ComparableGroups; Interpret(query,basis,perspective) -> Interpretation; ApplyScopedReply(caseId,questionDigest,answer,operationId) -> CorrectionReceipt | Stale; Explain(interpretationId,grant) -> ExplanationFrame.
//
// ontology.claims(claim_id PK,world_id,subject_id,predicate_id,value_json,unit,scope_json,valid_from,valid_until,source_family,evidence_refs,asserted_by,domain_id,knowledge_version); ontology.claim_edges(world_id,parent_id,child_id,kind PK); ontology.interpretations(interpretation_id PK,world_id,query_digest,release_digest,cut_digest,perspective,status,verification,contested,selected_refs,rival_refs,dependency_refs); ontology.corrections(correction_id PK,world_id,target_claim,successor_claim,actor,case_ref,receipt_ref). Values are immutable except governed erasure.
//
// [algorithm SPEC-005](../../docs/algorithms/spec-005.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
