// @zoen-plan tests/migrations/zn-0122.test.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `tests/migrations/zn-0122.test.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `tests/migrations/zn-0122.test.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-020](../../docs/specs/spec-020.md).
// Tickets: [ZN-0122](../../docs/tickets/zn-0122.md).
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
// ### SPEC-020
// CreateWatch(definition,scope,operationId) -> Watch; EvaluateWatch(watch,commitEnvelope) -> Checkpoint | Notice; DecideAttention(noticeRef,relationship) -> Deliver | Merge | Defer | Silence; PauseWatch/ResumeWatch/CancelWatch -> Receipt.
//
// ontology.watches(watch_id PK,world_id,definition_digest,subject_scope,state,checkpoint_cut,materiality_state); ontology.notices(notice_id PK,watch_id,transition_identity,basis_ref,state,UNIQUE(watch_id,transition_identity)); eve.attention(notice_id,relationship_id PK,state,reason,not_before,merge_group,last_checked_rights); ontology.subscriptions(subscription_id PK,world_id,plan_digest,cursor,state).
//
// [algorithm SPEC-020](../../docs/algorithms/spec-020.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
