# File plan — `db/migrations/zn-0228_residency.sql`

**Status:** planned; no product acceptance implied.

Target: `db/migrations/zn-0228_residency.sql`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-039](../../docs/specs/spec-039.md).
Tickets: [ZN-0228](../../docs/tickets/zn-0228.md).

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

### SPEC-039
ProvisionCell(profile,region,lock) -> StagedCell; AdmitCell(evidence) -> ActiveCell; RestoreCell(backup,ledger,profile) -> ReadOnlyCell; OpenPrivateConnector(profile) -> ScopedRoute.

Infrastructure state describes account/region/cell, authority database, object namespaces, KMS keys, private endpoints, workload identities, backup policy and admitted image digests. control.cells(cell_id PK,region,profile,epoch,admission_ref,state); audit.recovery_runs(run_id PK,cell_id,backup_ref,measured_rpo,measured_rto,evidence_ref). Customer content stays out of the directory/control plane.

[algorithm SPEC-039](../../docs/algorithms/spec-039.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
