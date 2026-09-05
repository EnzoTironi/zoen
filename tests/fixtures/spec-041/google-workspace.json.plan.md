# File plan — `tests/fixtures/spec-041/google-workspace.json`

**Status:** planned; no product acceptance implied.

Target: `tests/fixtures/spec-041/google-workspace.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-041](../../../docs/specs/spec-041.md).
Tickets: [ZN-0237](../../../docs/tickets/zn-0237.md).

## Responsibility and reuse

```text
CONDITIONAL INPUT FIXTURE PLAN — not an observed service result.
USE synthetic records within owned disposable namespaces and explicit valid/knowledge time.
INCLUDE comparable rivals, a denied source, duplicate provenance family and stale dependency when in scope.
COMPUTE fixed expected values from the owning oracle, not from the implementation under test.
LOAD through the real component/journey boundary; do not replace provider/database behavior with this file.
VERSION seed, units, rights and cleanup scope.
```

## Owning state / operation contracts

### SPEC-041
InstallConnectorRecipe(recipe,instance) -> SourceChange; QualifyConnector(recipe,providerAccount) -> Certificate; CompareBusinessMetrics(metricDefinitions,basis) -> ReconciliationFrame.

Released ConnectorRecipe includes provider/profile, versioned object schemas, endpoint/query templates, incremental strategy, auth scopes, ACL mapping, deletion semantics, freshness and supported record kinds. Per-install source instances, credentials, cursors and data remain outside reusable recipe artifacts.

[algorithm SPEC-041](../../../docs/algorithms/spec-041.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
