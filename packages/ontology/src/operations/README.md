# packages/ontology/src/operations

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-040](../../../../docs/specs/spec-040.md) — Fairness, economics, capacity admission and audited support; [algorithm SPEC-040](../../../../docs/algorithms/spec-040.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `audit-export.ts` | required | [read](audit-export.ts) |
| `fairness.ts` | required | [read](fairness.ts) |
| `index.ts` | conditional-support | [read](index.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `support-access.ts` | required | [read](support-access.ts) |
| `types.ts` | conditional-support | [read](types.ts) |
| `usage-economics.ts` | required | [read](usage-economics.ts) |

Shared invariants and dependencies: [repository contract](../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
