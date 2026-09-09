# OMS — Ontology Metadata Service (Language plane)

**Wave:** W1  
**Constitution:** [ADR-0001](adr/ADR-0001-operational-ontology-os.md) · [Glossary](glossary/operational-ontology.md) · [OO roadmap](roadmap-oo-os.md)

## What this is

`@zoen/oms` is the **Language plane** MVP: a versioned registry of **Object Types**, **Link Types**, and **Action Types** (schemas + cards). It is **not** a Foundry clone and does **not** execute Actions.

- Registry document is git-versioned (`packages/oms` seed). A PR is the MVP proposal / review path; in-product Ontology Branching is a later upgrade.
- Worlds is **pack #1** (`worlds`): World, Evidence, Source, Correction, Membership, ErasureAttempt — mapped from the glossary, not enterprise ERP types.
- Action Type stubs declare parameters, submission-criteria placeholders, and edit intent. **`runtimeBinding: semantic-executor`** until **W2** lands the Action runtime.

## What this is not

| Deferred                               | Wave |
| -------------------------------------- | ---- |
| Action runtime / grant path            | W2   |
| Worlds pack migration off tip executor | W3   |
| MCP codegen from Action Types          | W4   |
| Funnel-lite / Approvals-lite           | W5   |

No Eve / chat product surface. No Zep-as-kernel. Tip Worlds / MCP / CLI behavior is unchanged by this package (additive only).

## Package layout

| Path | Role |
| --- | --- |
| `packages/oms/src/schemas.ts` | Effect Schema cards for Object / Link / Action Types |
| `packages/oms/src/registry.ts` | Load, index, lookup; reject unknown Action Type ids |
| `packages/oms/src/packs/worlds.pack.json` | Worlds pack seed registry document |
| `packages/oms/src/packs/worlds.ts` | Semantic operation inventory |
| `packages/oms/test/registry.W1.test.ts` | Unit proof: load, lookup, completeness |

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

## Related

- [ADR-0001 — Operational Ontology OS](adr/ADR-0001-operational-ontology-os.md)
- [Roadmap W1 acceptance](roadmap-oo-os.md#w1--language-plane-oms-mvp)
