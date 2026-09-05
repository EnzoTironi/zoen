# File plan — `db/migrations/zn-0213_pack-registry.sql`

**Status:** planned; no product acceptance implied.

Target: `db/migrations/zn-0213_pack-registry.sql`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-037](../../docs/specs/spec-037.md).
Tickets: [ZN-0213](../../docs/tickets/zn-0213.md).

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

### SPEC-037
ResolvePackGraph(request,pinnedBase) -> LockedGraph; InstallPack(graph,overlay) -> Change; UpgradePack(install,target) -> SemanticDiff; RemovePack(install) -> DispositionPlan; VerifyPublisher(signature) -> VerifiedOrigin | Denied.

ontology.pack_versions(pack_digest PK,publisher,namespace,version,dependencies,requested_capabilities,artifact_refs,signature_ref,license_ref); ontology.pack_installs(install_id PK,world_id,pack_digest,overlay_ref,granted_scope,state); ontology.publisher_records(publisher_id PK,verified_identity,signing_keys,review_state); ontology.marketplace_entitlements(entitlement_id PK,world_id,pack_ref,terms_version,state). No publisher can query installed customer data by default.

[algorithm SPEC-037](../../docs/algorithms/spec-037.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
