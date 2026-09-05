# tooling

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-000](../docs/specs/spec-000.md) — Execution baseline, dependency admission and fail-closed CI; [algorithm SPEC-000](../docs/algorithms/spec-000.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `supply-chain.ts` | required | [read](supply-chain.ts) |
| `test-harness.ts` | required | [read](test-harness.ts) |
| `verify-ticket.ts` | required | [read](verify-ticket.ts) |
| `workspace.ts` | required | [read](workspace.ts.plan.md) |

Shared invariants and dependencies: [repository contract](../docs/architecture/repository-contract.md). Do not add another data/authorization path.
