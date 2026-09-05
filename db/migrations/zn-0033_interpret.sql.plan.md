# File plan — `db/migrations/zn-0033_interpret.sql`

**Status:** planned; no product acceptance implied.

Target: `db/migrations/zn-0033_interpret.sql`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-005](../../docs/specs/spec-005.md).
Tickets: [ZN-0033](../../docs/tickets/zn-0033.md).

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

### SPEC-005
CompareClaims(claims,meaningProfile) -> ComparableGroups; Interpret(query,basis,perspective) -> Interpretation; ApplyScopedReply(caseId,questionDigest,answer,operationId) -> CorrectionReceipt | Stale; Explain(interpretationId,grant) -> ExplanationFrame.

ontology.claims(claim_id PK,world_id,subject_id,predicate_id,value_json,unit,scope_json,valid_from,valid_until,source_family,evidence_refs,asserted_by,domain_id,knowledge_version); ontology.claim_edges(world_id,parent_id,child_id,kind PK); ontology.interpretations(interpretation_id PK,world_id,query_digest,release_digest,cut_digest,perspective,status,verification,contested,selected_refs,rival_refs,dependency_refs); ontology.corrections(correction_id PK,world_id,target_claim,successor_claim,actor,case_ref,receipt_ref). Values are immutable except governed erasure.

[algorithm SPEC-005](../../docs/algorithms/spec-005.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
