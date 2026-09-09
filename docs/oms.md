# OMS — Ontology Metadata Service (Language plane)

**Wave:** W1 (+ W4 MCP catalog)  
**Constitution:** [ADR-0001](adr/ADR-0001-operational-ontology-os.md) · [Glossary](glossary/operational-ontology.md) · [OO roadmap](roadmap-oo-os.md)

## What this is

`@zoen/oms` is the **Language plane** MVP: a versioned registry of **Object Types**, **Link Types**, and **Action Types** (schemas + cards). It is **not** a Foundry clone and does **not** execute Actions — execution is `@zoen/actions` (W2).

- Registry document is git-versioned (`packages/oms` seed). A PR is the MVP proposal / review path; in-product Ontology Branching is a later upgrade.
- Worlds is **pack #1** (`worlds`): World, Evidence, Source, Correction, Membership, ErasureAttempt — mapped from the glossary, not enterprise ERP types.
- Action Type stubs declare parameters, submission-criteria placeholders, and edit intent. **`runtimeBinding: semantic-executor`** names the Engine adapter; **W2–W3** [`@zoen/actions`](actions.md) ActionRunner is the governed write path (MCP/CLI Worlds pack primary; HTTP emission dual path). **W4** generates MCP Worlds tools from this registry (`mcp-codegen` + host binders). Subject-identity not yet OMS Action Types (MCP escape hatch).

## What this is not

| Deferred                      | Wave  |
| ----------------------------- | ----- |
| Funnel-lite / Approvals-lite  | W5    |
| Subject-identity Action Types | later |

Action runtime: see [actions.md](actions.md) (W2–W4).

No Eve / chat product surface. No Zep-as-kernel. OMS remains metadata-only; MCP tool **names** are derived here (W4) while execution stays in `@zoen/actions` / hosts.

## Package layout

| Path | Role |
| --- | --- |
| `packages/oms/src/schemas.ts` | Effect Schema cards for Object / Link / Action Types |
| `packages/oms/src/registry.ts` | Load, index, lookup; reject unknown Action Type ids |
| `packages/oms/src/packs/worlds.pack.json` | Worlds pack seed registry document |
| `packages/oms/src/packs/worlds.ts` | Semantic operation inventory |
| `packages/oms/src/mcp-codegen.ts` | W4: Worlds MCP tool catalog from Action Types |
| `packages/oms/test/registry.W1.test.ts` | Unit proof: load, lookup, completeness |
| `packages/oms/test/mcp-codegen.W4.test.ts` | Unit proof: tool names match Worlds Action Types |

## Usage (metadata only)

```ts
import { defaultOmsRegistry } from "@zoen/oms/packs/default-registry";
import { acceptActionStub } from "@zoen/oms/registry";

const create = acceptActionStub(
  defaultOmsRegistry,
  "worlds.CreatePersonalWorld"
);
// create.submissionCriteria / editIntent are declarations — Engine still tip executor
```

Unknown Action Type ids throw `UnknownTypeError` (fail closed). Accepting a stub does **not** mutate ontology authority.

## MCP codegen (W4)

`listWorldsMcpToolSpecs` / `listWorldsMcpToolNames` read loaded Worlds pack Action Types (`worldsSemanticOperations` order, then any additional registered Worlds ops). Duplicate `semanticOperation` values fail closed. `apps/mcp` assembles ListTools via `generateWorldsToolsFromOms`: **names** from OMS; **inputSchema + buildRequest** from thin host binders (`host-binders-worlds.ts`). Missing or extra binders fail closed. Subject-identity tools stay hand-maintained direct-engine ops (not OMS; documented escape hatch). CLI root help surfaces the same names via `apps/cli/src/worlds/oms-actions.ts`.

## Related

- [ADR-0001 — Operational Ontology OS](adr/ADR-0001-operational-ontology-os.md)
- [Roadmap W1 acceptance](roadmap-oo-os.md#w1--language-plane-oms-mvp)
