# File plan — `db/migrations/zn-0093_drift-acl.sql`

**Status:** planned; no product acceptance implied.

Target: `db/migrations/zn-0093_drift-acl.sql`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-015](../../docs/specs/spec-015.md).
Tickets: [ZN-0093](../../docs/tickets/zn-0093.md).

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

### SPEC-015
ConfigureSource(definition,instance,operationId) -> Binding; SyncSource(binding,cursor) -> CapturedBatch; AdmitBatch(binding,batch,expectedCursor) -> BatchReceipt; InventoryCoverage(world,scope) -> CoverageFrame.

ontology.source_inventory(source_id PK,world_id,owner,category,coverage_scope,expected_freshness,admission_state); ontology.source_bindings(binding_id PK,world_id,definition_digest,credential_ref,state,acl_policy_ref); jobs.source_cursors(binding_id,partition_id PK,cursor_json,watermark,lease_fence,schema_digest); ontology.source_health(binding_id,observed_at PK,status,gaps_json); ontology.source_tombstones(binding_id,external_id,revision PK,evidence_ref).

[algorithm SPEC-015](../../docs/algorithms/spec-015.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
