# packages/ontology/src/retrieval

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-025](../../../../docs/specs/spec-025.md) — Authorized retrieval and permitted specialized agents; [algorithm SPEC-025](../../../../docs/algorithms/spec-025.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `authorized-search.ts` | required | [read](authorized-search.ts) |
| `index.ts` | conditional-support | [read](index.ts) |
| `injection-containment.ts` | required | [read](injection-containment.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `search-frame.ts` | required | [read](search-frame.ts) |
| `search-projection.ts` | required | [read](search-projection.ts) |
| `specialized-agent.ts` | required | [read](specialized-agent.ts) |
| `types.ts` | conditional-support | [read](types.ts) |

Shared invariants and dependencies: [repository contract](../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
