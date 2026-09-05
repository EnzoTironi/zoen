# File plan — `tests/fixtures/spec-027/focus-navigation.json`

**Status:** planned; no product acceptance implied.

Target: `tests/fixtures/spec-027/focus-navigation.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-027](../../../docs/specs/spec-027.md).
Tickets: [ZN-0161](../../../docs/tickets/zn-0161.md).

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

### SPEC-027
OpenFocus(focus,freshGrant) -> Historical|Newer|UnavailableView; RenderChart(chartDocument,frame) -> AccessibleView; ExportView(frame,format,destination) -> AuthorizedExportCase.

Presentation definitions: ViewDefinition, ChartDocument, TableDefinition and FocusLens. Instance preferences remain Eve-owned data. Frame/Focus refs are opaque; browser caches include current principal/World/security revision and are discarded on logout/rebind.

[algorithm SPEC-027](../../../docs/algorithms/spec-027.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
