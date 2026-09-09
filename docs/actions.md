# Action runtime (Engine write path)

**Wave:** W2–W3  
**Constitution:** [ADR-0001](adr/ADR-0001-operational-ontology-os.md) · [Glossary](glossary/operational-ontology.md) · [OO roadmap](roadmap-oo-os.md) · [OMS](oms.md)

## What this is

`@zoen/actions` is the **Engine write path** MVP: an **ActionRunner** that executes OMS **Action Types** through a governed sequence:

1. Look up Action Type in OMS (unknown id → fail closed)
2. Validate parameters against the Action Type card
3. Evaluate submission-criteria placeholders (empty → pass-through; declared + unmet → fail closed; **no LLM grant path**)
4. Encode tip `SemanticRequest` and call the existing **SemanticExecutor / ApplicationApi** engine (adapter)
5. Append an **Action Log** entry (attempt + outcome; maps tip Receipt ideas)

Dual path remains intentional during transition: tip HTTP Worlds groups still call SemanticExecutor emission for receipts/disclosure; **MCP and CLI Worlds pack verbs** now go through ActionRunner (OMS lookup + Action Log) with ApplicationApi / SemanticExecutor as the Engine adapter.

## What this is not

| Deferred                                      | Wave  |
| --------------------------------------------- | ----- |
| MCP codegen from Action Types                 | W4    |
| Funnel-lite / Approvals-lite                  | W5    |
| Subject-identity OMS Action Types (W1 waived) | later |

No Eve / chat product. No Zep-as-kernel. No Foundry parity claim.

## Package layout

| Path | Role |
| --- | --- |
| `packages/actions/src/runner.ts` | ActionRunner (OMS → criteria → engine → log) |
| `packages/actions/src/parameters.ts` | Parameter validation against ActionType schema |
| `packages/actions/src/criteria.ts` | Submission-criteria placeholders (fail closed) |
| `packages/actions/src/encode.ts` | Worlds pack → SemanticRequest encoder |
| `packages/actions/src/map-request.ts` / `host-execute.ts` | SemanticRequest → ActionRunner (MCP/CLI host path) |
| `apps/server/src/actions/runtime.ts` | Composition: ActionRunner + PG Action Log |
| `packages/actions/src/log.ts` / `log-memory.ts` / `log-pg.ts` | Action Log port + memory + PG shape |
| `packages/actions/test/runner.W2.test.ts` | Unit proof |
| `ops/migrations/021_action_log.sql` | Durable append-only `authority.action_log` |

## Action Log design

- **Table:** `authority.action_log` (migration 021, `CREATE IF NOT EXISTS`, Fly inert-safe)
- **Append-only:** entry id, actor, actionTypeId, semanticOperation, operationId, world scope, outcome (`accepted` \| `rejected` \| `failed` \| `committed`), rejection code, receipt ref, result jsonb, timestamps
- **Unit tests** use in-memory log; composition can INSERT via `log-pg` SQL shape
- Tip `authority.receipts` remain for SemanticExecutor commits (receipts remain)

## Worlds Actions wired (OMS pack #1)

All Worlds pack Action Type stubs are executable through ActionRunner → SemanticExecutor adapter:

`CreatePersonalWorld`, `ImportEvidence`, `Inspect`, `OpenEvidence`, `ProposeCorrection`, `AnswerQuestion`, `UndoCorrection`, `InspectWorldAccess`, `GrantWorldReadAccess`, `RevokeWorldReadAccess`, `RequestWorldErasure`, `InspectWorldErasure`, `PurgeWorldContent`

End-to-end proof in W2 unit tests focuses on **CreatePersonalWorld** (happy path + Action Log). Host still supplies auth/owner/world-scope actor facts; Engine grant path stays tip SemanticExecutor.

## Usage

```ts
import { createActionRunner } from "@zoen/actions/runner";
import { createMemoryActionLog } from "@zoen/actions/log-memory";
import { defaultOmsRegistry } from "@zoen/oms/packs/default-registry";

const runner = createActionRunner({
  registry: defaultOmsRegistry,
  actor: {
    authenticated: true,
    isOwner: false,
    principalId,
    worldScope: false,
  },
  engine: { execute: (request) => semanticOrApplicationApi(request) },
  log: createMemoryActionLog(), // or PG-backed ActionLog
});

await runner.run({
  actionTypeId: "worlds.CreatePersonalWorld",
  parameters: { purpose: "personal-records", operationId },
});
```

## MCP / CLI host path (W3)

- **Primary:** `executeSemanticViaActionRunner` maps Worlds pack `SemanticRequest` → `worlds.*` Action Types, runs ActionRunner, then Engine (`ApplicationApi` HTTP).
- **Escape hatch:** subject-identity ops are **not** OMS Action Types yet (W1 waived) — they stay on direct SemanticRequest → ApplicationApi. Documented in [roadmap-oo-os.md](roadmap-oo-os.md) W3 notes.
- **Server:** `makeApplication` provides `ActionRuntime` (PG `createPgActionLog` on authority pool). HTTP emission path remains SemanticExecutor (receipts unchanged).

## Related

- [OMS (Language plane)](oms.md)
- [Roadmap W2 acceptance](roadmap-oo-os.md#w2--engine-write-path)
- [Roadmap W3 acceptance](roadmap-oo-os.md#w3--worlds-pack-migration)
