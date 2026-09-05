# File plan — `runbooks/spec-009/stream.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-009/stream.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-009](../../docs/specs/spec-009.md).
Tickets: [ZN-0055](../../docs/tickets/zn-0055.md).

## Responsibility and reuse

## ZN-0055 operational/repair procedure

Scope: Implement provisional streaming and settled message replay. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
It reconnects with the last received stream marker
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
ADMIT a durable ingress identity once; create turn and conversation-owned state without World credentials.
CLAIM a fenced lease and CAS state/version before each transition.
PERSIST model-call intent before network; record actual outcome/usage before scheduling tool work.
REOPEN grounding via the shared semantic client; preserve tool operation ID through retries and recovery.
STREAM provisional text explicitly; interrupted attempts are not silently spliced into a false exact continuation.
PERSIST settled visible message before handing it to channel delivery; deduplicate by turn/revision.
ON crash reconstruct from settled journal facts and pending intents; zombie fence cannot settle messages.
ON cancel or revoked rights stop future steps; retain known/unknown external attempts for reconciliation.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
It sees either the remaining known draft or an explicit interruption followed by the one settled response; no unsupported success is shown
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-009
AcceptTurn(ingressRef) -> TurnRef; AdvanceTurn(turnId,expectedVersion,fence,event) -> TurnState | LostLease; SettleVisibleMessage(turnId,attemptId,content) -> MessageRef; CancelTurn(turnId) -> CancellationState.

eve.conversations(conversation_id PK,relationship_id,world_ref_nullable,audience_ref,version); eve.turns(turn_id PK,conversation_id,ingress_id UNIQUE,state,version,lease_owner,fence,lease_until,release_digest); eve.attempts(attempt_id PK,turn_id,kind,intent_digest,output_ref,status,usage_json); eve.messages(message_id PK,turn_id,revision,state,visible_text,evidence_refs,UNIQUE(turn_id,revision)); eve.focus(focus_id PK,relationship_id,world_ref,subject_ref,frame_ref,lens,temporal_intent). No authority credentials in Eve tables.

[algorithm SPEC-009](../../docs/algorithms/spec-009.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
