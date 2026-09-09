# Execution frontier (decided)

Condensed from audit `FRONTIER.md` + `TIP-TO-TARGET.md` + `SHARED-UNDERSTANDING.md`. Status `decided` = design disposition, **not** production approval.

## Product grammar

- Primary surfaces: **web** and **CLI** over Worlds. Future SDK / MCP / Eve tools share **one** SemanticExecutor — no client-specific authority.
- **Agent/MCP** (future, D05 reoriented) = adapters over Worlds. Tip product surface is Worlds only — Eve chat/voice removed.
- **ICPs** (already named): household, bakery, clinic administration, personal/small-business finance. **No invented packs** or new commercial personas.
- **D0x** IDs are planning metadata only — not source paths or package ownership.

## Tip → target ownership (Now / Next)

| Responsibility | Now (observed roots) | Next (bounded) |
| --- | --- | --- |
| Product UI | `apps/web`, `apps/cli` | same roots |
| Domain kernel | `packages/ontology` | renamed from `packages/authority` (ZA-15); no dual package |
| Contracts | `packages/contracts` | per-family schemas + semantic envelope when needed |
| Auth / presence | server identity / worlds | stay server-owned; no Door package now |
| Sources / evidence / meaning / sharing / erasure | under `ontology/` by feature | first-class modules retained after ZA-15 rename |
| Eve | `ontology/ports/eve` + server composition | optional `apps/server/src/eve` + `contracts/eve` when repaired |
| I/O adapters | `apps/server/src/adapters` | extract only for a real second consumer |
| Deploy / migrate | `ops/` | stay; Docker local; Fly `zoen-rebuild`; no paid staging |
| Unbuilt hosts / packs | absent | absent until a real capability trigger |

**Tech reality at audit scan:** Effect HttpApi, React/Vite, Better Auth, PG/Effect SQL, S3/RustFS. **Not** established as current: GraphQL, Cedar, Temporal workflow, SSE streaming, Rivet, Workflow/Cluster composition. Re-verify with G-TIP before claiming otherwise.

## Policy precedence

1. Enzo's latest explicit constraints.
2. Current `AGENTS.md` **Pre-launch Evolution** and product invariants / README (no shims, dual-read/write, or compatibility layers unless explicitly requested).
3. Frozen feature semantics under (1–2).
4. This audit's explicit decisions and bounded PR contracts.
5. Verified source/runtime evidence.
6. Historical reports and architecture images (non-normative intent only).

Pre-launch Evolution **supersedes** older atlas advice to keep shims or dual protocol readers. Preserve historical evidence and unauthorized hosted resources; do **not** wipe Fly `zoen` or other retained installs by inference.

## Order (high level)

External tip/CI fallout → residual naming / test baseline → local operational / erasure safety → optional package elegance → scoped ICP journeys. Eve safety may progress in an independent lane. Full D03/D05 and long-horizon hosts remain gated — see [za-plan.md](za-plan.md) and [anti-list.md](anti-list.md).
