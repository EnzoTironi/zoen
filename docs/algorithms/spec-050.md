# SPEC-050 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-050](../specs/spec-050.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Kernel and Client Platform**. Module: `packages/ontology/src/surfaces`. Milestone: **S0**.

## Normative operation signatures

```text
SemanticCall(envelope, verifiedRequestContext) -> tagged SemanticResult. Discover, Inspect, Propose, AnswerCase, Commit, Subscribe, Export and admitted Analysis are released operation families, not free-form repository methods.
```

## State and transaction contract

No new authority store. Reuse operation registry, grants, read guards, ActionCases, receipts and outbox. Descriptor/cache keys bind world, principal, delegation, app binding, purpose, release, query digest, cut and security revision. Cursor/chunk handles are references, not bearer permits.

## Shared algorithm

```text
NORMALIZE transport input into the common envelope; obtain identity and app/workload context only from verified server bindings.
RESOLVE allowed operation using the existing SPEC-007 dispatcher; do not instantiate another executor.
PRESERVE intent ID, contract digest, basis and purpose on retry/resumption; a new ID is a new intention.
INTERSECT current user/delegation rights, admitted app capabilities and current source restrictions centrally.
FOR batches/streams/exports support bounded work and exact basis; reauthorize each item/chunk/resumption.
CACHE only with full subject/World/delegation/app/purpose/release/query/cut/security key; references are not permits.
COMPARE canonical semantic outcomes under equivalent authority/basis, not natural-language presentation.
AUDIT every ingress/asset/export/worker path for bypasses; structured app calls require neither Eve nor an LLM.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0291](../tickets/zn-0291.md) | Bind every structured ingress to the existing semantic dispatcher | [packages/ontology/src/surfaces/executor-binding.ts](../../packages/ontology/src/surfaces/executor-binding.ts) |
| [ZN-0292](../tickets/zn-0292.md) | Enforce client-to-data import and credential boundaries | [tooling/semantic-boundaries/no-bypass-graph.ts](../../tooling/semantic-boundaries/no-bypass-graph.ts) |
| [ZN-0293](../tickets/zn-0293.md) | Bind current app and delegation restrictions in verified context | [packages/ontology/src/surfaces/effective-context.ts](../../packages/ontology/src/surfaces/effective-context.ts) |
| [ZN-0294](../tickets/zn-0294.md) | Implement bounded batch, cursor and export calls on the shared surface | [packages/ontology/src/surfaces/bounded-reads.ts](../../packages/ontology/src/surfaces/bounded-reads.ts) |
| [ZN-0295](../tickets/zn-0295.md) | Unify subscriptions, chunk leases and dense reads without bypass | [packages/ontology/src/surfaces/streaming-path.ts](../../packages/ontology/src/surfaces/streaming-path.ts) |

## Required proof boundaries

Use the existing dispatcher and current disclosure checks for every ingress including resumptions and background calls. Preserve original operationId on retry/continuation; distinct IDs are distinct intentions, not magically deduplicated. Compare normalized meaning rather than prose. Verify context at the server; transport headers never set identity. Bounded batch/async operations reuse per-item policy and exact basis.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
