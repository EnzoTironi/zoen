# File plan — `packs/connectors/spec-041/pack.json`

**Status:** planned; no product acceptance implied.

Target: `packs/connectors/spec-041/pack.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-041](../../../docs/specs/spec-041.md).
Tickets: [ZN-0237](../../../docs/tickets/zn-0237.md), [ZN-0238](../../../docs/tickets/zn-0238.md), [ZN-0239](../../../docs/tickets/zn-0239.md), [ZN-0240](../../../docs/tickets/zn-0240.md), [ZN-0241](../../../docs/tickets/zn-0241.md), [ZN-0242](../../../docs/tickets/zn-0242.md).

## Responsibility and reuse

```text
DATA-ONLY PACK PLAN.
DECLARE stable semantic IDs, typed objects/links, meanings, units, rules, views/actions and dependency closure.
COMPOSE existing kernel operators; no per-customer TypeScript or source credentials in reusable pack data.
COMPILE/evaluate/publish through normal definition governance.
KEEP instance secrets/cursors/private records out of reusable artifacts; rights requests are not grants.
```

## Owning state / operation contracts

### SPEC-041
InstallConnectorRecipe(recipe,instance) -> SourceChange; QualifyConnector(recipe,providerAccount) -> Certificate; CompareBusinessMetrics(metricDefinitions,basis) -> ReconciliationFrame.

Released ConnectorRecipe includes provider/profile, versioned object schemas, endpoint/query templates, incremental strategy, auth scopes, ACL mapping, deletion semantics, freshness and supported record kinds. Per-install source instances, credentials, cursors and data remain outside reusable recipe artifacts.

[algorithm SPEC-041](../../../docs/algorithms/spec-041.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
