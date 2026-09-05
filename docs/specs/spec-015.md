# SPEC-015 — Source inventory, OAuth bindings and declarative integration plans

**Milestone:** S2 · **Owner:** Integrations · **Root:** `packages/ontology/src/sources`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
All company data means an explicit inventory of authorized sources with visible coverage gaps, not an assertion of universal ingestion. Integration instances and mappings are runtime data; credentials stay in the broker. Source completeness, deletions, ACL freshness and schema drift are contractual.

## Owned state and storage contract
ontology.source_inventory(source_id PK,world_id,owner,category,coverage_scope,expected_freshness,admission_state); ontology.source_bindings(binding_id PK,world_id,definition_digest,credential_ref,state,acl_policy_ref); jobs.source_cursors(binding_id,partition_id PK,cursor_json,watermark,lease_fence,schema_digest); ontology.source_health(binding_id,observed_at PK,status,gaps_json); ontology.source_tombstones(binding_id,external_id,revision PK,evidence_ref).

## Operations

```text
ConfigureSource(definition,instance,operationId) -> Binding; SyncSource(binding,cursor) -> CapturedBatch; AdmitBatch(binding,batch,expectedCursor) -> BatchReceipt; InventoryCoverage(world,scope) -> CoverageFrame.
```

## Execution protocol
HTTP plans bind method/path templates, allowlisted host, pagination, schema, rate limits and auth references. URL/headers supplied by data cannot redirect credentials. Cursor advances only with durable capture/admission handoff. Detect drift before interpreting records. A missing record means deleted only for an explicitly complete authoritative snapshot. ACL outages age data rights according to policy and can fail closed.

V4 refinement: A source connector is an acquisition implementation behind admitted source operations, not an app-owned data API. Apps cannot call OAuth providers directly, ask for connector credentials or bypass evidence admission.

V4 normative detail: [single semantic path](../architecture/semantic-path.md).

## Pseudocode and file ownership

[algorithm SPEC-015](../algorithms/spec-015.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0089](../tickets/zn-0089.md) | Build runtime source inventory and honest coverage | component | [ZN-0030](../tickets/zn-0030.md), [ZN-0081](../tickets/zn-0081.md), [ZN-0088](../tickets/zn-0088.md) |
| [ZN-0090](../tickets/zn-0090.md) | Implement brokered OAuth and secret references | component | [ZN-0089](../tickets/zn-0089.md) |
| [ZN-0091](../tickets/zn-0091.md) | Execute constrained HTTP source plans | component | [ZN-0090](../tickets/zn-0090.md) |
| [ZN-0092](../tickets/zn-0092.md) | Commit incremental cursors without record loss | component | [ZN-0091](../tickets/zn-0091.md) |
| [ZN-0093](../tickets/zn-0093.md) | Quarantine schema drift and map ACL identities | component | [ZN-0092](../tickets/zn-0092.md) |
| [ZN-0094](../tickets/zn-0094.md) | Propagate explicit source tombstones safely | component | [ZN-0093](../tickets/zn-0093.md) |
| [ZN-0095](../tickets/zn-0095.md) | Qualify one real read-only source connection | admission | [ZN-0094](../tickets/zn-0094.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `connectors-and-ingestion.md`, `runtime-variation-and-releases.md`. Read a named historical reference only when needed; it cannot override current contracts.
