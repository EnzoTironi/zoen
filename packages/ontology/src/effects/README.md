# packages/ontology/src/effects

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-023](../../../../docs/specs/spec-023.md) — Effect execution, provider evidence and honest settlement; [algorithm SPEC-023](../../../../docs/algorithms/spec-023.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `effect-attempt.ts` | required | [read](effect-attempt.ts) |
| `effect-cancel.ts` | required | [read](effect-cancel.ts) |
| `effect-permits.ts` | required | [read](effect-permits.ts) |
| `effect-reconcile.ts` | required | [read](effect-reconcile.ts) |
| `index.ts` | conditional-support | [read](index.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `restate-adapter.ts` | required | [read](restate-adapter.ts) |
| `types.ts` | conditional-support | [read](types.ts) |

Shared invariants and dependencies: [repository contract](../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
