# packages/ontology/src/interpretation

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-005](../../../../docs/specs/spec-005.md) — Comparable claims, interpretations and scoped correction; [algorithm SPEC-005](../../../../docs/algorithms/spec-005.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `claims.ts` | conditional-support | [read](claims.ts.plan.md) |
| `comparability.ts` | required | [read](comparability.ts) |
| `correction.ts` | required | [read](correction.ts) |
| `families.ts` | required | [read](families.ts) |
| `impact.ts` | required | [read](impact.ts) |
| `index.ts` | conditional-support | [read](index.ts) |
| `interpret.ts` | required | [read](interpret.ts) |
| `interpretation-laws.ts` | required | [read](interpretation-laws.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `reconcile.ts` | conditional-support | [read](reconcile.ts.plan.md) |
| `types.ts` | conditional-support | [read](types.ts) |

Shared invariants and dependencies: [repository contract](../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
