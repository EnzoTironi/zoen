# File plan — `contracts/spec-041/enterprise-reconciliation.schema.json`

**Status:** planned; no product acceptance implied.

Target: `contracts/spec-041/enterprise-reconciliation.schema.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-041](../../docs/specs/spec-041.md).
Tickets: [ZN-0244](../../docs/tickets/zn-0244.md).

## Responsibility and reuse

```text
CONDITIONAL SCHEMA PLAN — no permissive {} schema or fabricated generated types.
RESOLVE exact input/output/tagged-error fields from the operation signatures and common protocol.
REQUIRE bounded sizes/depth/arrays, exact discriminants, validated IDs and explicit optional/null distinctions.
REJECT additional or authority-bearing client fields; money/counters stay strings where required.
GENERATE canonical fixtures, wire types and surface descriptors from this single reviewed schema source.
TEST malformed/oversized/unknown-version inputs and exact round trips; registry presence alone is not a pass.
```

## Owning state / operation contracts

### SPEC-041
InstallConnectorRecipe(recipe,instance) -> SourceChange; QualifyConnector(recipe,providerAccount) -> Certificate; CompareBusinessMetrics(metricDefinitions,basis) -> ReconciliationFrame.

Released ConnectorRecipe includes provider/profile, versioned object schemas, endpoint/query templates, incremental strategy, auth scopes, ACL mapping, deletion semantics, freshness and supported record kinds. Per-install source instances, credentials, cursors and data remain outside reusable recipe artifacts.

[algorithm SPEC-041](../../docs/algorithms/spec-041.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
