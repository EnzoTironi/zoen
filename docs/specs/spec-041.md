# SPEC-041 — Enterprise source recipes and domain-wide reconciliation

**Milestone:** S9 · **Owner:** Enterprise Data · **Root:** `packs/connectors`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Provide concrete connector qualification tracks without promising access to every proprietary system. Each recipe declares objects, pagination/CDC, schema drift, ACLs, tombstones, data-use restrictions and coverage. Missing proprietary APIs remain visible source gaps.

## Owned state and storage contract
Released ConnectorRecipe includes provider/profile, versioned object schemas, endpoint/query templates, incremental strategy, auth scopes, ACL mapping, deletion semantics, freshness and supported record kinds. Per-install source instances, credentials, cursors and data remain outside reusable recipe artifacts.

## Operations

```text
InstallConnectorRecipe(recipe,instance) -> SourceChange; QualifyConnector(recipe,providerAccount) -> Certificate; CompareBusinessMetrics(metricDefinitions,basis) -> ReconciliationFrame.
```

## Execution protocol
Recipes compose existing source/flow/artifact protocols; do not create an SDK-shaped authority bypass. Every provider ticket must read the current primary API documentation and record exact supported versions/scopes before implementation. Use real owned source accounts and authorized synthetic input records, not substitute service peers. Missing service qualification remains blocked.

## Pseudocode and file ownership

[algorithm SPEC-041](../algorithms/spec-041.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0237](../tickets/zn-0237.md) | Implement Google Workspace document and change recipe | component | [ZN-0094](../tickets/zn-0094.md), [ZN-0111](../tickets/zn-0111.md), [ZN-0178](../tickets/zn-0178.md), [ZN-0191](../tickets/zn-0191.md), [ZN-0223](../tickets/zn-0223.md) |
| [ZN-0238](../tickets/zn-0238.md) | Implement Microsoft 365 and SharePoint document recipe | component | [ZN-0237](../tickets/zn-0237.md) |
| [ZN-0239](../tickets/zn-0239.md) | Implement CRM account and opportunity recipe | component | [ZN-0238](../tickets/zn-0238.md) |
| [ZN-0240](../tickets/zn-0240.md) | Implement ERP OData/HTTP invoice and supplier recipe | component | [ZN-0239](../tickets/zn-0239.md) |
| [ZN-0241](../tickets/zn-0241.md) | Implement PostgreSQL snapshot-plus-CDC source recipe | component | [ZN-0240](../tickets/zn-0240.md) |
| [ZN-0242](../tickets/zn-0242.md) | Implement warehouse virtual/captured read recipe | component | [ZN-0241](../tickets/zn-0241.md) |
| [ZN-0243](../tickets/zn-0243.md) | Qualify enterprise connectors with real accounts and scope manifests | admission | [ZN-0242](../tickets/zn-0242.md) |
| [ZN-0244](../tickets/zn-0244.md) | Prove company-wide metric definitions and disagreement stewardship | journey | [ZN-0242](../tickets/zn-0242.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `connectors-and-ingestion.md`, `capability-horizon.md`, `ontology-and-standards.md`. Read a named historical reference only when needed; it cannot override current contracts.
