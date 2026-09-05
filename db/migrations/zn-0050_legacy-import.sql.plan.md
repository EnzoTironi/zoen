# File plan — `db/migrations/zn-0050_legacy-import.sql`

**Status:** planned; no product acceptance implied.

Target: `db/migrations/zn-0050_legacy-import.sql`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-008](../../docs/specs/spec-008.md).
Tickets: [ZN-0050](../../docs/tickets/zn-0050.md).

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

### SPEC-008
Health() -> Liveness; Readiness() -> AdmittedDependencies; ExportOperationalEvidence(scope) -> RedactedReport; RestoreAdmission(backupRef,deletionCut,effectLedger) -> ReadOnlyReady | Blocked.

audit.operational_events(event_id PK,world_ref_nullable,actor_ref,kind,redacted_payload,occurred_at,retention_class); jobs.recovery_fences(cell_id PK,epoch,dispatch_enabled,deletion_ledger_cut); infra migration manifest contains legacy source commit, row counts, rights mapping and unmatched records.

[algorithm SPEC-008](../../docs/algorithms/spec-008.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
