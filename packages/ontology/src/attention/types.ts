// @zoen-plan packages/ontology/src/attention/types.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/attention/types.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/attention/types.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-020](../../../../docs/specs/spec-020.md).
// Tickets: [ZN-0118](../../../../docs/tickets/zn-0118.md), [ZN-0119](../../../../docs/tickets/zn-0119.md), [ZN-0120](../../../../docs/tickets/zn-0120.md), [ZN-0121](../../../../docs/tickets/zn-0121.md), [ZN-0122](../../../../docs/tickets/zn-0122.md).
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
// ### SPEC-020
// CreateWatch(definition,scope,operationId) -> Watch; EvaluateWatch(watch,commitEnvelope) -> Checkpoint | Notice; DecideAttention(noticeRef,relationship) -> Deliver | Merge | Defer | Silence; PauseWatch/ResumeWatch/CancelWatch -> Receipt.
//
// ontology.watches(watch_id PK,world_id,definition_digest,subject_scope,state,checkpoint_cut,materiality_state); ontology.notices(notice_id PK,watch_id,transition_identity,basis_ref,state,UNIQUE(watch_id,transition_identity)); eve.attention(notice_id,relationship_id PK,state,reason,not_before,merge_group,last_checked_rights); ontology.subscriptions(subscription_id PK,world_id,plan_digest,cursor,state).
//
// [algorithm SPEC-020](../../../../docs/algorithms/spec-020.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
