# packages/ontology/src/stewardship

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-017](../../../../docs/specs/spec-017.md) — Clarification prioritization and scoped stewardship; [algorithm SPEC-017](../../../../docs/algorithms/spec-017.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `index.ts` | conditional-support | [read](index.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `question-lifecycle.ts` | required | [read](question-lifecycle.ts) |
| `question-priority.ts` | required | [read](question-priority.ts) |
| `reply-kinds.ts` | required | [read](reply-kinds.ts) |
| `steward-routing.ts` | required | [read](steward-routing.ts) |
| `types.ts` | conditional-support | [read](types.ts) |

Shared invariants and dependencies: [repository contract](../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
