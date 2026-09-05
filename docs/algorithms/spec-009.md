# SPEC-009 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-009](../specs/spec-009.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Experience**. Module: `packages/eve/src/turns`. Milestone: **S1**.

## Normative operation signatures

```text
AcceptTurn(ingressRef) -> TurnRef; AdvanceTurn(turnId,expectedVersion,fence,event) -> TurnState | LostLease; SettleVisibleMessage(turnId,attemptId,content) -> MessageRef; CancelTurn(turnId) -> CancellationState.
```

## State and transaction contract

eve.conversations(conversation_id PK,relationship_id,world_ref_nullable,audience_ref,version); eve.turns(turn_id PK,conversation_id,ingress_id UNIQUE,state,version,lease_owner,fence,lease_until,release_digest); eve.attempts(attempt_id PK,turn_id,kind,intent_digest,output_ref,status,usage_json); eve.messages(message_id PK,turn_id,revision,state,visible_text,evidence_refs,UNIQUE(turn_id,revision)); eve.focus(focus_id PK,relationship_id,world_ref,subject_ref,frame_ref,lens,temporal_intent). No authority credentials in Eve tables.

## Shared algorithm

```text
ADMIT a durable ingress identity once; create turn and conversation-owned state without World credentials.
CLAIM a fenced lease and CAS state/version before each transition.
PERSIST model-call intent before network; record actual outcome/usage before scheduling tool work.
REOPEN grounding via the shared semantic client; preserve tool operation ID through retries and recovery.
STREAM provisional text explicitly; interrupted attempts are not silently spliced into a false exact continuation.
PERSIST settled visible message before handing it to channel delivery; deduplicate by turn/revision.
ON crash reconstruct from settled journal facts and pending intents; zombie fence cannot settle messages.
ON cancel or revoked rights stop future steps; retain known/unknown external attempts for reconciliation.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0052](../tickets/zn-0052.md) | Create the single interaction journal and turn lifecycle | [packages/eve/src/turns/turn-store.ts](../../packages/eve/src/turns/turn-store.ts) |
| [ZN-0053](../tickets/zn-0053.md) | Fence model attempts and persist intent before inference | [packages/eve/src/turns/model-attempt.ts](../../packages/eve/src/turns/model-attempt.ts) |
| [ZN-0054](../tickets/zn-0054.md) | Dispatch tools through idempotent semantic clients | [packages/eve/src/turns/tool-dispatch.ts](../../packages/eve/src/turns/tool-dispatch.ts) |
| [ZN-0055](../tickets/zn-0055.md) | Implement provisional streaming and settled message replay | [packages/eve/src/turns/stream.ts](../../packages/eve/src/turns/stream.ts) |
| [ZN-0056](../tickets/zn-0056.md) | Implement cancellation, supersession and release-change stops | [packages/eve/src/turns/turn-stop.ts](../../packages/eve/src/turns/turn-stop.ts) |
| [ZN-0057](../tickets/zn-0057.md) | Prove all turn crash boundaries with real processes | [tests/chaos/spec-009/turn-chaos.test.ts](../../tests/chaos/spec-009/turn-chaos.test.ts) |

## Required proof boundaries

Persist model intent before call, output before tool proposal and final visible message before delivery. State transitions are CAS protected. Stream drafts are provisional. A failed stream is explicitly interrupted; do not splice unrelated retry tokens into a supposedly exact continuation. Same ingress is accepted once, and same tool semantic operation ID survives recovery.

V4 refinement: Eve is a semantic client, never a prerequisite for structured application calls. No LLM is involved in a structured table read unless a released operation explicitly requests a model.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
