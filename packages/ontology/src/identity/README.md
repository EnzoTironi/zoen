# packages/ontology/src/identity

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-006](../../../../docs/specs/spec-006.md) — Reversible domain identity and temporal explanations; [algorithm SPEC-006](../../../../docs/algorithms/spec-006.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `aliases.ts` | required | [read](aliases.ts) |
| `identity-case.ts` | required | [read](identity-case.ts) |
| `identity-laws.ts` | required | [read](identity-laws.ts) |
| `index.ts` | conditional-support | [read](index.ts) |
| `merge.ts` | required | [read](merge.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `split.ts` | required | [read](split.ts) |
| `types.ts` | conditional-support | [read](types.ts) |

Shared invariants and dependencies: [repository contract](../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
