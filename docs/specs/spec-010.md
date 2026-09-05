# SPEC-010 — Context, grounded composition, model routing and voice

**Milestone:** S1 · **Owner:** Experience · **Root:** `packages/eve/src/context`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Context is freshly compiled permitted material, not a universal memory. Summaries aid interaction but never become evidence. Models propose; deterministic semantic operations decide. Voice transcripts remain attributed, correctable interpretations of retained audio.

## Owned state and storage contract
eve.context_snapshots(context_id PK,turn_id,release_digest,visible_message_refs,frame_refs,skill_ref,model_route_ref,purpose,budget_ref); eve.summaries(summary_id PK,conversation_id,through_message_id,text,model_ref,expires_at); eve.model_observations(attempt_id PK,provider,model,usage,output_ref,retention_ref). Raw hidden reasoning fields are excluded by schema.

## Operations

```text
CompileContext(turn,grant,limits) -> ContextBundle | IncompleteBasis; SelectModel(requestPurpose,dataUse,region,budget) -> PermittedRoute | NoPermittedModel; ProposeTranscript(audioEvidence,languageHint) -> AttributedTranscript.
```

## Execution protocol
Freshly reopen every Frame used in context. Mark untrusted source text as data and isolate it from instructions. A tool set is the intersection of released skill, principal grant and current runtime policy. Route only to admitted model/data-use/residency profiles. Optional missing sources yield honest partial state. A voice transcription cannot authorize a consequential action without the normal confirmation path.

V4 refinement: Grounding and tool execution use the SPEC-007 SemanticExecutor through a narrow client. Model-generated principal, role, grants or provider credentials are never accepted as authority.

V4 normative detail: [single semantic path](../architecture/semantic-path.md).

## Pseudocode and file ownership

[algorithm SPEC-010](../algorithms/spec-010.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0058](../tickets/zn-0058.md) | Compile bounded provenance-carrying context | component | [ZN-0057](../tickets/zn-0057.md) |
| [ZN-0059](../tickets/zn-0059.md) | Compact conversational history without creating facts | component | [ZN-0058](../tickets/zn-0058.md) |
| [ZN-0060](../tickets/zn-0060.md) | Implement permitted model routing and usage accounting | component | [ZN-0059](../tickets/zn-0059.md) |
| [ZN-0061](../tickets/zn-0061.md) | Implement honest answer composition and evidence linking | component | [ZN-0060](../tickets/zn-0060.md) |
| [ZN-0062](../tickets/zn-0062.md) | Add audio transcription with provenance and correction | component | [ZN-0061](../tickets/zn-0061.md) |
| [ZN-0063](../tickets/zn-0063.md) | Qualify the actual model and voice provider profiles | admission | [ZN-0062](../tickets/zn-0062.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `models-retrieval-and-agents.md`, `release-policy-eve.md`. Read a named historical reference only when needed; it cannot override current contracts.
