# packages/ontology/src/continuations

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-051](../../../../docs/specs/spec-051.md) — Authority-free continuation links and scoped application sessions; [algorithm SPEC-051](../../../../docs/algorithms/spec-051.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `app-sessions.ts` | required | [read](app-sessions.ts) |
| `continuation-registry.ts` | required | [read](continuation-registry.ts) |
| `index.ts` | conditional-support | [read](index.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `types.ts` | conditional-support | [read](types.ts) |

Shared invariants and dependencies: [repository contract](../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
