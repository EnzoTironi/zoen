# packages/ontology/src/federation

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-043](../../../../docs/specs/spec-043.md) — Federated Frames, independent approvals and partial global outcomes; [algorithm SPEC-043](../../../../docs/algorithms/spec-043.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `coordination-compensation.ts` | required | [read](coordination-compensation.ts) |
| `coordination.ts` | required | [read](coordination.ts) |
| `federated-read.ts` | required | [read](federated-read.ts) |
| `federation-links.ts` | required | [read](federation-links.ts) |
| `index.ts` | conditional-support | [read](index.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `types.ts` | conditional-support | [read](types.ts) |

Shared invariants and dependencies: [repository contract](../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
