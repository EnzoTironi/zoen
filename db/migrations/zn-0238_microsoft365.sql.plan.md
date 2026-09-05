# File plan — `db/migrations/zn-0238_microsoft365.sql`

**Status:** planned; no product acceptance implied.

Target: `db/migrations/zn-0238_microsoft365.sql`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-041](../../docs/specs/spec-041.md).
Tickets: [ZN-0238](../../docs/tickets/zn-0238.md).

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

### SPEC-041
InstallConnectorRecipe(recipe,instance) -> SourceChange; QualifyConnector(recipe,providerAccount) -> Certificate; CompareBusinessMetrics(metricDefinitions,basis) -> ReconciliationFrame.

Released ConnectorRecipe includes provider/profile, versioned object schemas, endpoint/query templates, incremental strategy, auth scopes, ACL mapping, deletion semantics, freshness and supported record kinds. Per-install source instances, credentials, cursors and data remain outside reusable recipe artifacts.

[algorithm SPEC-041](../../docs/algorithms/spec-041.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
