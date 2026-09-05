# SPEC-041 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-041](../specs/spec-041.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Enterprise Data**. Module: `packs/connectors`. Milestone: **S9**.

## Normative operation signatures

```text
InstallConnectorRecipe(recipe,instance) -> SourceChange; QualifyConnector(recipe,providerAccount) -> Certificate; CompareBusinessMetrics(metricDefinitions,basis) -> ReconciliationFrame.
```

## State and transaction contract

Released ConnectorRecipe includes provider/profile, versioned object schemas, endpoint/query templates, incremental strategy, auth scopes, ACL mapping, deletion semantics, freshness and supported record kinds. Per-install source instances, credentials, cursors and data remain outside reusable recipe artifacts.

## Shared algorithm

```text
LOAD a versioned source recipe and actual provider API/account qualification, not customer-specific code branches.
VALIDATE auth scope, object schemas, namespace/revision keys, incremental/deletion rules and inherited ACLs.
CONFIGURE instance credentials/cursors outside the reusable pack; use ordinary SourceChange governance.
ACQUIRE actual source data with source machinery and checkpoint only durable admissions.
COMPARE business metrics only after normalizing meanings, entities, scope, time and unit.
KEEP booked/invoiced/received or forecast/actual as different meanings; comparable contradictions retain both sources.
ROUTE scoped questions to authorized stewards and publish reusable mappings only through evaluation/release.
TEST actual owned source accounts with synthetic authorized records; absent source is blocked, never a simulated business result.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0237](../tickets/zn-0237.md) | Implement Google Workspace document and change recipe | [packs/connectors/spec-041/google-workspace.json](../../packs/connectors/spec-041/google-workspace.json.plan.md) |
| [ZN-0238](../tickets/zn-0238.md) | Implement Microsoft 365 and SharePoint document recipe | [packs/connectors/spec-041/microsoft365.json](../../packs/connectors/spec-041/microsoft365.json.plan.md) |
| [ZN-0239](../tickets/zn-0239.md) | Implement CRM account and opportunity recipe | [packs/connectors/spec-041/salesforce.json](../../packs/connectors/spec-041/salesforce.json.plan.md) |
| [ZN-0240](../tickets/zn-0240.md) | Implement ERP OData/HTTP invoice and supplier recipe | [packs/connectors/spec-041/sap-erp.json](../../packs/connectors/spec-041/sap-erp.json.plan.md) |
| [ZN-0241](../tickets/zn-0241.md) | Implement PostgreSQL snapshot-plus-CDC source recipe | [packs/connectors/spec-041/postgres-cdc.json](../../packs/connectors/spec-041/postgres-cdc.json.plan.md) |
| [ZN-0242](../tickets/zn-0242.md) | Implement warehouse virtual/captured read recipe | [packs/connectors/spec-041/warehouse.json](../../packs/connectors/spec-041/warehouse.json.plan.md) |
| [ZN-0243](../tickets/zn-0243.md) | Qualify enterprise connectors with real accounts and scope manifests | [admissions/spec-041/enterprise-source-qualification.json](../../admissions/spec-041/enterprise-source-qualification.json.plan.md) |
| [ZN-0244](../tickets/zn-0244.md) | Prove company-wide metric definitions and disagreement stewardship | [tests/journey/spec-041/enterprise-reconciliation.test.ts](../../tests/journey/spec-041/enterprise-reconciliation.test.ts) |

## Required proof boundaries

Recipes compose existing source/flow/artifact protocols; do not create an SDK-shaped authority bypass. Every provider ticket must read the current primary API documentation and record exact supported versions/scopes before implementation. Use real owned source accounts and authorized synthetic input records, not substitute service peers. Missing service qualification remains blocked.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
