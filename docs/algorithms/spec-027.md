# SPEC-027 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-027](../specs/spec-027.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Experience**. Module: `apps/web/src/living-world`. Milestone: **S5**.

## Normative operation signatures

```text
OpenFocus(focus,freshGrant) -> Historical|Newer|UnavailableView; RenderChart(chartDocument,frame) -> AccessibleView; ExportView(frame,format,destination) -> AuthorizedExportCase.
```

## State and transaction contract

Presentation definitions: ViewDefinition, ChartDocument, TableDefinition and FocusLens. Instance preferences remain Eve-owned data. Frame/Focus refs are opaque; browser caches include current principal/World/security revision and are discarded on logout/rebind.

## Shared algorithm

```text
REOPEN authority-free Focus with fresh identity/rights; resolve pinned historical or explicitly newer Frame.
VALIDATE view/chart/table definitions against released component registry and semantic bindings.
FETCH bounded authorized data through common client; no direct index/SQL/chart data endpoint.
RENDER missing, zero, unknown, disputed and provisional values distinctly with basis and evidence access.
USE admitted declarative chart primitives only; no executable formatter/HTML injection.
PRESERVE keyboard/focus/text alternatives and test real browser accessibility and zoom behavior.
KEY private caches by full subject/World/purpose/version/security scope; clear on logout/rebind.
EXPORT through released export operation with fresh chunk authorization and current licensing.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0159](../tickets/zn-0159.md) | Define ChartDocument and table/timeline contracts | [apps/web/src/living-world/view-contracts.ts](../../apps/web/src/living-world/view-contracts.ts) |
| [ZN-0160](../tickets/zn-0160.md) | Render accessible multi-density inspections | [tests/journey/spec-027/view-renderers.test.ts](../../tests/journey/spec-027/view-renderers.test.ts) |
| [ZN-0161](../tickets/zn-0161.md) | Preserve Focus across chat and visual deepening | [tests/journey/spec-027/focus-navigation.test.ts](../../tests/journey/spec-027/focus-navigation.test.ts) |
| [ZN-0162](../tickets/zn-0162.md) | Make exports and shared-device behavior rights preserving | [apps/web/src/living-world/view-export.ts](../../apps/web/src/living-world/view-export.ts) |
| [ZN-0163](../tickets/zn-0163.md) | Prove dense-view usability and basis parity | [tests/journey/spec-027/view-journey.test.ts](../../tests/journey/spec-027/view-journey.test.ts) |

## Required proof boundaries

Use ECharts only for declared chart primitives and data; reject executable formatters and arbitrary HTML. Preserve zero/missing/unknown/disputed states in charts. Text/table alternatives expose the same permitted data. A view move may request a newer Frame but must label it; historical intent is not silently replaced.

V4 refinement: Views and exports reuse the early SPEC-052 app renderer and shared semantic client. Do not introduce direct SQL/chart/index endpoints. Evidence references and provenance are preserved through display transformations.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
