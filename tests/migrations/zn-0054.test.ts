// @zoen-plan tests/migrations/zn-0054.test.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `tests/migrations/zn-0054.test.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `tests/migrations/zn-0054.test.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-009](../../docs/specs/spec-009.md).
// Tickets: [ZN-0054](../../docs/tickets/zn-0054.md).
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
// ### SPEC-009
// AcceptTurn(ingressRef) -> TurnRef; AdvanceTurn(turnId,expectedVersion,fence,event) -> TurnState | LostLease; SettleVisibleMessage(turnId,attemptId,content) -> MessageRef; CancelTurn(turnId) -> CancellationState.
//
// eve.conversations(conversation_id PK,relationship_id,world_ref_nullable,audience_ref,version); eve.turns(turn_id PK,conversation_id,ingress_id UNIQUE,state,version,lease_owner,fence,lease_until,release_digest); eve.attempts(attempt_id PK,turn_id,kind,intent_digest,output_ref,status,usage_json); eve.messages(message_id PK,turn_id,revision,state,visible_text,evidence_refs,UNIQUE(turn_id,revision)); eve.focus(focus_id PK,relationship_id,world_ref,subject_ref,frame_ref,lens,temporal_intent). No authority credentials in Eve tables.
//
// [algorithm SPEC-009](../../docs/algorithms/spec-009.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
