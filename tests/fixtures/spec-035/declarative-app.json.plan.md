# File plan — `tests/fixtures/spec-035/declarative-app.json`

**Status:** planned; no product acceptance implied.

Target: `tests/fixtures/spec-035/declarative-app.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-035](../../../docs/specs/spec-035.md).
Tickets: [ZN-0203](../../../docs/tickets/zn-0203.md).

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

### SPEC-035
EditDraft -> Draft; PreviewApp -> IsolatedPreview; PublishApp -> existing DefinitionChange process. AppBridgeRequest is a transport envelope for SemanticCall, not a domain data API.

MiniAppDefinition is released meaning owned by Ontology. SPEC-052 owns definition/manifest contracts; SPEC-051 owns authority-free links and scoped execution sessions; SPEC-029 owns signed artifacts; SPEC-053 owns non-authoritative bridge/runner state. eve.builder_drafts remains non-authoritative authoring state. No app authority database.

[algorithm SPEC-035](../../../docs/algorithms/spec-035.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
