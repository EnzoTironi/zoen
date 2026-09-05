// @zoen-plan packages/eve/src/turns/ports.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/eve/src/turns/ports.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/eve/src/turns/ports.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-009](../../../../docs/specs/spec-009.md).
// Tickets: [ZN-0052](../../../../docs/tickets/zn-0052.md), [ZN-0053](../../../../docs/tickets/zn-0053.md), [ZN-0054](../../../../docs/tickets/zn-0054.md), [ZN-0055](../../../../docs/tickets/zn-0055.md), [ZN-0056](../../../../docs/tickets/zn-0056.md).
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
// ### SPEC-009
// AcceptTurn(ingressRef) -> TurnRef; AdvanceTurn(turnId,expectedVersion,fence,event) -> TurnState | LostLease; SettleVisibleMessage(turnId,attemptId,content) -> MessageRef; CancelTurn(turnId) -> CancellationState.
//
// eve.conversations(conversation_id PK,relationship_id,world_ref_nullable,audience_ref,version); eve.turns(turn_id PK,conversation_id,ingress_id UNIQUE,state,version,lease_owner,fence,lease_until,release_digest); eve.attempts(attempt_id PK,turn_id,kind,intent_digest,output_ref,status,usage_json); eve.messages(message_id PK,turn_id,revision,state,visible_text,evidence_refs,UNIQUE(turn_id,revision)); eve.focus(focus_id PK,relationship_id,world_ref,subject_ref,frame_ref,lens,temporal_intent). No authority credentials in Eve tables.
//
// [algorithm SPEC-009](../../../../docs/algorithms/spec-009.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
