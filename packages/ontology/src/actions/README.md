# packages/ontology/src/actions

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-022](../../../../docs/specs/spec-022.md) — Released Actions, approvals and accountable local decisions; [algorithm SPEC-022](../../../../docs/algorithms/spec-022.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `action-plan.ts` | required | [read](action-plan.ts) |
| `approvals.ts` | required | [read](approvals.ts) |
| `case-commit.ts` | required | [read](case-commit.ts) |
| `case-store.ts` | required | [read](case-store.ts) |
| `index.ts` | conditional-support | [read](index.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `types.ts` | conditional-support | [read](types.ts) |

Shared invariants and dependencies: [repository contract](../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
