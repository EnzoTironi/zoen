# SPEC-015 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-015](../specs/spec-015.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Integrations**. Module: `packages/ontology/src/sources`. Milestone: **S2**.

## Normative operation signatures

```text
ConfigureSource(definition,instance,operationId) -> Binding; SyncSource(binding,cursor) -> CapturedBatch; AdmitBatch(binding,batch,expectedCursor) -> BatchReceipt; InventoryCoverage(world,scope) -> CoverageFrame.
```

## State and transaction contract

ontology.source_inventory(source_id PK,world_id,owner,category,coverage_scope,expected_freshness,admission_state); ontology.source_bindings(binding_id PK,world_id,definition_digest,credential_ref,state,acl_policy_ref); jobs.source_cursors(binding_id,partition_id PK,cursor_json,watermark,lease_fence,schema_digest); ontology.source_health(binding_id,observed_at PK,status,gaps_json); ontology.source_tombstones(binding_id,external_id,revision PK,evidence_ref).

## Shared algorithm

```text
REGISTER provider recipe and instance separately; record credential references only.
VALIDATE scopes, source namespaces, allowed destinations, query templates, incremental strategy and license/ACL behavior.
PERFORM real OAuth binding through supported provider flow; validate state/PKCE/redirect contract in admitted adapter.
STORE secret material only in broker-owned secret storage; runtime definition sees an opaque binding reference.
ACQUIRE bounded source pages with watermark and request identity; source missing page is not deletion.
CHECK current source rights/freshness; stage raw capture before mapping/admission through existing evidence machinery.
COMMIT checkpoints only after durable capture/admission position; deduplicate replay without dropping genuine revision changes.
QUALIFY each actual source account/profile; missing permission or credentials keeps that binding disabled, not emulated.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0089](../tickets/zn-0089.md) | Build runtime source inventory and honest coverage | [packages/ontology/src/sources/inventory.ts](../../packages/ontology/src/sources/inventory.ts) |
| [ZN-0090](../tickets/zn-0090.md) | Implement brokered OAuth and secret references | [packages/ontology/src/sources/oauth-binding.ts](../../packages/ontology/src/sources/oauth-binding.ts) |
| [ZN-0091](../tickets/zn-0091.md) | Execute constrained HTTP source plans | [packages/ontology/src/sources/http-plan.ts](../../packages/ontology/src/sources/http-plan.ts) |
| [ZN-0092](../tickets/zn-0092.md) | Commit incremental cursors without record loss | [packages/ontology/src/sources/checkpoints.ts](../../packages/ontology/src/sources/checkpoints.ts) |
| [ZN-0093](../tickets/zn-0093.md) | Quarantine schema drift and map ACL identities | [packages/ontology/src/sources/drift-acl.ts](../../packages/ontology/src/sources/drift-acl.ts) |
| [ZN-0094](../tickets/zn-0094.md) | Propagate explicit source tombstones safely | [packages/ontology/src/sources/tombstones.ts](../../packages/ontology/src/sources/tombstones.ts) |
| [ZN-0095](../tickets/zn-0095.md) | Qualify one real read-only source connection | [admissions/spec-015/source-qualification.json](../../admissions/spec-015/source-qualification.json.plan.md) |

## Required proof boundaries

HTTP plans bind method/path templates, allowlisted host, pagination, schema, rate limits and auth references. URL/headers supplied by data cannot redirect credentials. Cursor advances only with durable capture/admission handoff. Detect drift before interpreting records. A missing record means deleted only for an explicitly complete authoritative snapshot. ACL outages age data rights according to policy and can fail closed.

V4 refinement: A source connector is an acquisition implementation behind admitted source operations, not an app-owned data API. Apps cannot call OAuth providers directly, ask for connector credentials or bypass evidence admission.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
