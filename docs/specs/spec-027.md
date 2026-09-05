# SPEC-027 — Living World charts, tables, timelines and safe Focus

**Milestone:** S5 · **Owner:** Experience · **Root:** `apps/web/src/living-world`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Conversation and visual inspection share one semantic subject and basis. Dense views use released descriptors and authorized Frames, never direct database queries. Chart code does not become an execution escape hatch.

## Owned state and storage contract
Presentation definitions: ViewDefinition, ChartDocument, TableDefinition and FocusLens. Instance preferences remain Eve-owned data. Frame/Focus refs are opaque; browser caches include current principal/World/security revision and are discarded on logout/rebind.

## Operations

```text
OpenFocus(focus,freshGrant) -> Historical|Newer|UnavailableView; RenderChart(chartDocument,frame) -> AccessibleView; ExportView(frame,format,destination) -> AuthorizedExportCase.
```

## Execution protocol
Use ECharts only for declared chart primitives and data; reject executable formatters and arbitrary HTML. Preserve zero/missing/unknown/disputed states in charts. Text/table alternatives expose the same permitted data. A view move may request a newer Frame but must label it; historical intent is not silently replaced.

V4 refinement: Views and exports reuse the early SPEC-052 app renderer and shared semantic client. Do not introduce direct SQL/chart/index endpoints. Evidence references and provenance are preserved through display transformations.

V4 normative detail: [single semantic path](../architecture/semantic-path.md).

## Pseudocode and file ownership

[algorithm SPEC-027](../algorithms/spec-027.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0159](../tickets/zn-0159.md) | Define ChartDocument and table/timeline contracts | component | [ZN-0073](../tickets/zn-0073.md), [ZN-0152](../tickets/zn-0152.md), [ZN-0158](../tickets/zn-0158.md) |
| [ZN-0160](../tickets/zn-0160.md) | Render accessible multi-density inspections | journey | [ZN-0159](../tickets/zn-0159.md) |
| [ZN-0161](../tickets/zn-0161.md) | Preserve Focus across chat and visual deepening | journey | [ZN-0160](../tickets/zn-0160.md) |
| [ZN-0162](../tickets/zn-0162.md) | Make exports and shared-device behavior rights preserving | component | [ZN-0161](../tickets/zn-0161.md), [ZN-0203](../tickets/zn-0203.md) |
| [ZN-0163](../tickets/zn-0163.md) | Prove dense-view usability and basis parity | journey | [ZN-0162](../tickets/zn-0162.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `apps-charts-and-surfaces.md`, `interfaces-sdk-and-mcp.md`. Read a named historical reference only when needed; it cannot override current contracts.
