# File plan — `db/migrations/zn-0115_legal-hold.sql`

**Status:** planned; no product acceptance implied.

Target: `db/migrations/zn-0115_legal-hold.sql`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-019](../../docs/specs/spec-019.md).
Tickets: [ZN-0115](../../docs/tickets/zn-0115.md).

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

### SPEC-019
RequestErasure(scope) -> ReviewedCase; PlanErasure(case,basis) -> ArtifactClosure; ExecuteErasure(task,permit) -> DeletionReceipt; CheckRestoreSuppression(restoredCut,currentLedger) -> SuppressionPlan | Blocked.

ontology.retention_policies(policy_id PK,scope,purpose,expiry_rule,hold_rules,version); ontology.erasure_cases(case_id PK,scope,requested_by,state,decision_ref); ontology.erasure_tasks(task_id PK,case_id,artifact_ref,store,kind,state,receipt_ref); audit.deletion_ledger(sequence PK,scope_digest,artifact_ref,decision_ref,effective_at); ontology.holds(hold_id PK,scope,authority_evidence,expires_at,state). Deletion ledger durability is separate from a restored application backup.

[algorithm SPEC-019](../../docs/algorithms/spec-019.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
