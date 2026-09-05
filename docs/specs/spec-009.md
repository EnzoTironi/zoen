# SPEC-009 — Eve fenced turn machine and visible-message recovery

**Milestone:** S1 · **Owner:** Experience · **Root:** `packages/eve/src/turns`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
One EveStore owns interaction history and resumption. A durable model call is not exactly-once inference. Only one fenced attempt may settle a visible turn; tools always cross the semantic boundary.

## Owned state and storage contract
eve.conversations(conversation_id PK,relationship_id,world_ref_nullable,audience_ref,version); eve.turns(turn_id PK,conversation_id,ingress_id UNIQUE,state,version,lease_owner,fence,lease_until,release_digest); eve.attempts(attempt_id PK,turn_id,kind,intent_digest,output_ref,status,usage_json); eve.messages(message_id PK,turn_id,revision,state,visible_text,evidence_refs,UNIQUE(turn_id,revision)); eve.focus(focus_id PK,relationship_id,world_ref,subject_ref,frame_ref,lens,temporal_intent). No authority credentials in Eve tables.

## Operations

```text
AcceptTurn(ingressRef) -> TurnRef; AdvanceTurn(turnId,expectedVersion,fence,event) -> TurnState | LostLease; SettleVisibleMessage(turnId,attemptId,content) -> MessageRef; CancelTurn(turnId) -> CancellationState.
```

## Execution protocol
Persist model intent before call, output before tool proposal and final visible message before delivery. State transitions are CAS protected. Stream drafts are provisional. A failed stream is explicitly interrupted; do not splice unrelated retry tokens into a supposedly exact continuation. Same ingress is accepted once, and same tool semantic operation ID survives recovery.

V4 refinement: Eve is a semantic client, never a prerequisite for structured application calls. No LLM is involved in a structured table read unless a released operation explicitly requests a model.

V4 normative detail: [single semantic path](../architecture/semantic-path.md).

## Pseudocode and file ownership

[algorithm SPEC-009](../algorithms/spec-009.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0052](../tickets/zn-0052.md) | Create the single interaction journal and turn lifecycle | component | [ZN-0041](../tickets/zn-0041.md), [ZN-0046](../tickets/zn-0046.md), [ZN-0051](../tickets/zn-0051.md) |
| [ZN-0053](../tickets/zn-0053.md) | Fence model attempts and persist intent before inference | component | [ZN-0052](../tickets/zn-0052.md) |
| [ZN-0054](../tickets/zn-0054.md) | Dispatch tools through idempotent semantic clients | component | [ZN-0053](../tickets/zn-0053.md) |
| [ZN-0055](../tickets/zn-0055.md) | Implement provisional streaming and settled message replay | component | [ZN-0054](../tickets/zn-0054.md) |
| [ZN-0056](../tickets/zn-0056.md) | Implement cancellation, supersession and release-change stops | component | [ZN-0055](../tickets/zn-0055.md) |
| [ZN-0057](../tickets/zn-0057.md) | Prove all turn crash boundaries with real processes | chaos | [ZN-0056](../tickets/zn-0056.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `release-policy-eve.md`, `messaging-channels.md`. Read a named historical reference only when needed; it cannot override current contracts.
