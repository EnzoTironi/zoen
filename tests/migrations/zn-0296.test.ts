// @zoen-plan tests/migrations/zn-0296.test.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `tests/migrations/zn-0296.test.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `tests/migrations/zn-0296.test.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-051](../../docs/specs/spec-051.md).
// Tickets: [ZN-0296](../../docs/tickets/zn-0296.md).
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
// ### SPEC-051
// CreateContinuation(target,scope,recipient?,expiry?,operationId) -> LinkRef; ResolveContinuation(ref) -> GenericLanding|AuthorizedTarget; OpenApp(ref,verifiedPresence) -> AppSession|Denied; RevokeContinuation(ref) -> Receipt; RevokeAppSession(ref) -> Receipt.
//
// ontology.continuations(link_ref PK,world_id,realm,focus_ref,target_kind,target_ref,version_policy,recipient_constraint_nullable,expires_at_nullable,state,creator,created_receipt); target_kind=focus|app. ontology.app_sessions(session_ref PK,world_id,realm,principal,actor,installation_ref_nullable,publication_binding,scope_digest,purpose,assurance,security_revision,expires_at,state). Relationships/World grants remain existing ontology records. Opaque handles have at least 192 random bits; logs are redacted. Door owns browser challenge records, not app business permissions.
//
// [algorithm SPEC-051](../../docs/algorithms/spec-051.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
