# SPEC-035 — Progressive Workshop: early declarative apps, isolated views and full Studio

**Milestone:** S8 · **Owner:** Builder Platform · **Root:** `apps/web/src/studio`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Studio is an advanced authoring surface over the same runtime definitions and semantic executor. Declarative runtime is delivered in S2, isolated executable delivery in S6 and rich Studio in S8. There is one app renderer/host, not a replacement at each milestone.

## Owned state and storage contract
MiniAppDefinition is released meaning owned by Ontology. SPEC-052 owns definition/manifest contracts; SPEC-051 owns authority-free links and scoped execution sessions; SPEC-029 owns signed artifacts; SPEC-053 owns non-authoritative bridge/runner state. eve.builder_drafts remains non-authoritative authoring state. No app authority database.

## Operations

```text
EditDraft -> Draft; PreviewApp -> IsolatedPreview; PublishApp -> existing DefinitionChange process. AppBridgeRequest is a transport envelope for SemanticCall, not a domain data API.
```

## Execution protocol
Reuse SPEC-050..054 without business logic in the bridge. Agent and human editors use the same runtime change operations. Full Studio composes the already-shipped declarative renderer, safe host, signed executable artifact and published operation manifest. It must not route reads through Eve/LLMs, access source credentials or create a second reconciliation engine.

Per-ticket stages override this full-Studio S8 label. ZN-0203 is S2; ZN-0204 and ZN-0205 are S6; ZN-0202 and ZN-0206 remain S8. Their exact DAG is normative; dense infrastructure is not required for the early renderer.

Read [mini-app contract](../architecture/mini-app-contract.md), [links](../architecture/protected-links.md) and [host security](../architecture/app-host-security.md).

## Pseudocode and file ownership

[algorithm SPEC-035](../algorithms/spec-035.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0202](../tickets/zn-0202.md) | Build Studio definition, rule and integration editors | journey | [ZN-0088](../tickets/zn-0088.md), [ZN-0163](../tickets/zn-0163.md), [ZN-0185](../tickets/zn-0185.md), [ZN-0305](../tickets/zn-0305.md), [ZN-0311](../tickets/zn-0311.md) |
| [ZN-0203](../tickets/zn-0203.md) | Implement declarative operational app runtime | component | [ZN-0071](../tickets/zn-0071.md), [ZN-0299](../tickets/zn-0299.md), [ZN-0303](../tickets/zn-0303.md), [ZN-0304](../tickets/zn-0304.md) |
| [ZN-0204](../tickets/zn-0204.md) | Implement isolated executable app origin and bridge | component | [ZN-0203](../tickets/zn-0203.md), [ZN-0311](../tickets/zn-0311.md) |
| [ZN-0205](../tickets/zn-0205.md) | Implement negotiated MCP Apps delivery | component | [ZN-0156](../tickets/zn-0156.md), [ZN-0204](../tickets/zn-0204.md) |
| [ZN-0206](../tickets/zn-0206.md) | Prove agent-generated application without new authority paths | journey | [ZN-0202](../tickets/zn-0202.md), [ZN-0205](../tickets/zn-0205.md), [ZN-0319](../tickets/zn-0319.md), [ZN-0321](../tickets/zn-0321.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `apps-charts-and-surfaces.md`, `runtime-variation-and-releases.md`, `interfaces-sdk-and-mcp.md`. Read a named historical reference only when needed; it cannot override current contracts.
