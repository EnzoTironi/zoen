# SPEC-010 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-010](../specs/spec-010.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Experience**. Module: `packages/eve/src/context`. Milestone: **S1**.

## Normative operation signatures

```text
CompileContext(turn,grant,limits) -> ContextBundle | IncompleteBasis; SelectModel(requestPurpose,dataUse,region,budget) -> PermittedRoute | NoPermittedModel; ProposeTranscript(audioEvidence,languageHint) -> AttributedTranscript.
```

## State and transaction contract

eve.context_snapshots(context_id PK,turn_id,release_digest,visible_message_refs,frame_refs,skill_ref,model_route_ref,purpose,budget_ref); eve.summaries(summary_id PK,conversation_id,through_message_id,text,model_ref,expires_at); eve.model_observations(attempt_id PK,provider,model,usage,output_ref,retention_ref). Raw hidden reasoning fields are excluded by schema.

## Shared algorithm

```text
LOAD only settled visible conversation events and authority-free Focus.
REOPEN every referenced Frame under current rights/purpose; missing context remains an explicit gap.
SEGREGATE retrieved source text as untrusted data, not executable instructions or tool policy.
INTERSECT released skill, current grant, app/workload scope and budget to determine tools.
SELECT only an admitted model/data-use/residency route with sufficient budget; otherwise NoPermittedModel.
COMPOSE bounded context with evidence references and provisional summaries; exclude hidden reasoning fields.
CAPTURE real provider outputs and usage; validate structured calls and send them to the same semantic executor.
TREAT audio transcription as an attributed candidate statement; consequential consent uses the normal confirmation path.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0058](../tickets/zn-0058.md) | Compile bounded provenance-carrying context | [packages/eve/src/context/compile-context.ts](../../packages/eve/src/context/compile-context.ts) |
| [ZN-0059](../tickets/zn-0059.md) | Compact conversational history without creating facts | [packages/eve/src/context/compaction.ts](../../packages/eve/src/context/compaction.ts) |
| [ZN-0060](../tickets/zn-0060.md) | Implement permitted model routing and usage accounting | [packages/eve/src/context/model-routing.ts](../../packages/eve/src/context/model-routing.ts) |
| [ZN-0061](../tickets/zn-0061.md) | Implement honest answer composition and evidence linking | [packages/eve/src/context/composition.ts](../../packages/eve/src/context/composition.ts) |
| [ZN-0062](../tickets/zn-0062.md) | Add audio transcription with provenance and correction | [packages/eve/src/context/voice.ts](../../packages/eve/src/context/voice.ts) |
| [ZN-0063](../tickets/zn-0063.md) | Qualify the actual model and voice provider profiles | [admissions/spec-010/provider-qualification.json](../../admissions/spec-010/provider-qualification.json.plan.md) |

## Required proof boundaries

Freshly reopen every Frame used in context. Mark untrusted source text as data and isolate it from instructions. A tool set is the intersection of released skill, principal grant and current runtime policy. Route only to admitted model/data-use/residency profiles. Optional missing sources yield honest partial state. A voice transcription cannot authorize a consequential action without the normal confirmation path.

V4 refinement: Grounding and tool execution use the SPEC-007 SemanticExecutor through a narrow client. Model-generated principal, role, grants or provider credentials are never accepted as authority.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
