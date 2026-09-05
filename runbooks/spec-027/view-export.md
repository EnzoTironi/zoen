# File plan — `runbooks/spec-027/view-export.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-027/view-export.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-027](../../docs/specs/spec-027.md).
Tickets: [ZN-0162](../../docs/tickets/zn-0162.md).

## Responsibility and reuse

## ZN-0162 operational/repair procedure

Scope: Make exports and shared-device behavior rights preserving. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
Export runs
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
REOPEN authority-free Focus with fresh identity/rights; resolve pinned historical or explicitly newer Frame.
VALIDATE view/chart/table definitions against released component registry and semantic bindings.
FETCH bounded authorized data through common client; no direct index/SQL/chart data endpoint.
RENDER missing, zero, unknown, disputed and provisional values distinctly with basis and evidence access.
USE admitted declarative chart primitives only; no executable formatter/HTML injection.
PRESERVE keyboard/focus/text alternatives and test real browser accessibility and zoom behavior.
KEY private caches by full subject/World/purpose/version/security scope; clear on logout/rebind.
EXPORT through released export operation with fresh chunk authorization and current licensing.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
The operation is denied or restricted under the license; shared-device caches do not leak the series
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-027
OpenFocus(focus,freshGrant) -> Historical|Newer|UnavailableView; RenderChart(chartDocument,frame) -> AccessibleView; ExportView(frame,format,destination) -> AuthorizedExportCase.

Presentation definitions: ViewDefinition, ChartDocument, TableDefinition and FocusLens. Instance preferences remain Eve-owned data. Frame/Focus refs are opaque; browser caches include current principal/World/security revision and are discarded on logout/rebind.

[algorithm SPEC-027](../../docs/algorithms/spec-027.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
