# File plan — `db/migrations/zn-0102_steward-routing.sql`

**Status:** planned; no product acceptance implied.

Target: `db/migrations/zn-0102_steward-routing.sql`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-017](../../docs/specs/spec-017.md).
Tickets: [ZN-0102](../../docs/tickets/zn-0102.md).

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

### SPEC-017
RankClarifications(scope,budget) -> QuestionQueue; AssignSteward(question,principal) -> Assignment; AnswerQuestion(question,digest,answerKind,payload,operationId) -> ScopedReceipt | RuleDraft | Stale.

ontology.clarifications(question_id PK,world_id,subject,predicate,scope_digest,candidate_digest,basis_ref,impact,deadline,state,steward_ref); ontology.stewardships(stewardship_id PK,world_id,scope,principal_ref,authority_kind,valid_interval); eve.question_delivery(question_id,relationship_id PK,attention_state,last_presented_digest). Deduplicate by world/subject/predicate/scope/candidate version.

[algorithm SPEC-017](../../docs/algorithms/spec-017.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
