# SPEC-050 — One semantic executor and transport-only client contract

**Milestone:** S0 · **Owner:** Kernel and Client Platform · **Root:** `packages/ontology/src/surfaces`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Name and extend SPEC-007 dispatch.ts as the single SemanticExecutor. No generic app API, policy clone, agent-only read path or LLM requirement. Surface adapters translate transport only. Equality is semantic at equal principal/delegation, audience, purpose, app constraints, release, cut and source rights; no requirement for byte-identical presentation.

## Owned state and storage contract
No new authority store. Reuse operation registry, grants, read guards, ActionCases, receipts and outbox. Descriptor/cache keys bind world, principal, delegation, app binding, purpose, release, query digest, cut and security revision. Cursor/chunk handles are references, not bearer permits.

## Operations

```text
SemanticCall(envelope, verifiedRequestContext) -> tagged SemanticResult. Discover, Inspect, Propose, AnswerCase, Commit, Subscribe, Export and admitted Analysis are released operation families, not free-form repository methods.
```

## Execution protocol
Use the existing dispatcher and current disclosure checks for every ingress including resumptions and background calls. Preserve original operationId on retry/continuation; distinct IDs are distinct intentions, not magically deduplicated. Compare normalized meaning rather than prose. Verify context at the server; transport headers never set identity. Bounded batch/async operations reuse per-item policy and exact basis.

Canonical detailed contract: [semantic path](../architecture/semantic-path.md). Tickets introduce successively richer families; early S0 use does not depend on S3/S7 work.

## Pseudocode and file ownership

[algorithm SPEC-050](../algorithms/spec-050.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0291](../tickets/zn-0291.md) | Bind every structured ingress to the existing semantic dispatcher | component | [ZN-0043](../tickets/zn-0043.md), [ZN-0044](../tickets/zn-0044.md) |
| [ZN-0292](../tickets/zn-0292.md) | Enforce client-to-data import and credential boundaries | static | [ZN-0003](../tickets/zn-0003.md), [ZN-0291](../tickets/zn-0291.md) |
| [ZN-0293](../tickets/zn-0293.md) | Bind current app and delegation restrictions in verified context | component | [ZN-0086](../tickets/zn-0086.md), [ZN-0291](../tickets/zn-0291.md) |
| [ZN-0294](../tickets/zn-0294.md) | Implement bounded batch, cursor and export calls on the shared surface | component | [ZN-0158](../tickets/zn-0158.md), [ZN-0162](../tickets/zn-0162.md), [ZN-0293](../tickets/zn-0293.md) |
| [ZN-0295](../tickets/zn-0295.md) | Unify subscriptions, chunk leases and dense reads without bypass | component | [ZN-0184](../tickets/zn-0184.md), [ZN-0196](../tickets/zn-0196.md), [ZN-0294](../tickets/zn-0294.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `interfaces-sdk-and-mcp.md`, `rights-and-access-control.md`. Read a named historical reference only when needed; it cannot override current contracts.
