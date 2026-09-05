# File plan — `db/migrations/zn-0058_compile-context.sql`

**Status:** planned; no product acceptance implied.

Target: `db/migrations/zn-0058_compile-context.sql`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-010](../../docs/specs/spec-010.md).
Tickets: [ZN-0058](../../docs/tickets/zn-0058.md).

## Responsibility and reuse

```text
CONDITIONAL MIGRATION PLAN — never feed this Markdown to a migrator.
IF no durable invariant is introduced by the owning ticket: do not create a no-op SQL migration.
OTHERWISE acquire the global schema lock; inspect existing catalog and table owner before adding DDL.
DECLARE explicit types, primary/unique keys, World+realm composite foreign references and indexes.
SEPARATE migrator DDL from runtime roles; parameterize values and retain source/rights/retention lineage.
ORDER expand → backfill → validate → contract, with restartable bounded backfill.
TEST empty database, prior-schema upgrade, role denials, crash boundary and forward repair using real PostgreSQL.
ASSIGN final monotonic migration number only when the genuine SQL is reviewed; never pre-record a planned migration as applied.
```

## Owning state / operation contracts

### SPEC-010
CompileContext(turn,grant,limits) -> ContextBundle | IncompleteBasis; SelectModel(requestPurpose,dataUse,region,budget) -> PermittedRoute | NoPermittedModel; ProposeTranscript(audioEvidence,languageHint) -> AttributedTranscript.

eve.context_snapshots(context_id PK,turn_id,release_digest,visible_message_refs,frame_refs,skill_ref,model_route_ref,purpose,budget_ref); eve.summaries(summary_id PK,conversation_id,through_message_id,text,model_ref,expires_at); eve.model_observations(attempt_id PK,provider,model,usage,output_ref,retention_ref). Raw hidden reasoning fields are excluded by schema.

[algorithm SPEC-010](../../docs/algorithms/spec-010.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
