# File plan — `runbooks/spec-010/provider-qualification.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-010/provider-qualification.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-010](../../docs/specs/spec-010.md).
Tickets: [ZN-0063](../../docs/tickets/zn-0063.md).

## Responsibility and reuse

## ZN-0063 operational/repair procedure

Scope: Qualify the actual model and voice provider profiles. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
Production model/voice activation is requested
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
LOAD only settled visible conversation events and authority-free Focus.
REOPEN every referenced Frame under current rights/purpose; missing context remains an explicit gap.
SEGREGATE retrieved source text as untrusted data, not executable instructions or tool policy.
INTERSECT released skill, current grant, app/workload scope and budget to determine tools.
SELECT only an admitted model/data-use/residency route with sufficient budget; otherwise NoPermittedModel.
COMPOSE bounded context with evidence references and provisional summaries; exclude hidden reasoning fields.
CAPTURE real provider outputs and usage; validate structured calls and send them to the same semantic executor.
TREAT audio transcription as an attributed candidate statement; consequential consent uses the normal confirmation path.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
Activation remains blocked; a real accepted qualification report records observed behavior and all limitations
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-010
CompileContext(turn,grant,limits) -> ContextBundle | IncompleteBasis; SelectModel(requestPurpose,dataUse,region,budget) -> PermittedRoute | NoPermittedModel; ProposeTranscript(audioEvidence,languageHint) -> AttributedTranscript.

eve.context_snapshots(context_id PK,turn_id,release_digest,visible_message_refs,frame_refs,skill_ref,model_route_ref,purpose,budget_ref); eve.summaries(summary_id PK,conversation_id,through_message_id,text,model_ref,expires_at); eve.model_observations(attempt_id PK,provider,model,usage,output_ref,retention_ref). Raw hidden reasoning fields are excluded by schema.

[algorithm SPEC-010](../../docs/algorithms/spec-010.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
