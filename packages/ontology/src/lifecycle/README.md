# packages/ontology/src/lifecycle

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-019](../../../../docs/specs/spec-019.md) — Retention, erasure, legal holds and restore suppression; [algorithm SPEC-019](../../../../docs/algorithms/spec-019.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `erasure-execute.ts` | required | [read](erasure-execute.ts) |
| `erasure-plan.ts` | required | [read](erasure-plan.ts) |
| `index.ts` | conditional-support | [read](index.ts) |
| `legal-hold.ts` | required | [read](legal-hold.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `retention-policy.ts` | required | [read](retention-policy.ts) |
| `types.ts` | conditional-support | [read](types.ts) |

Shared invariants and dependencies: [repository contract](../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
