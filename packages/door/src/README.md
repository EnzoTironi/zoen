# packages/door/src

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-002](../../../docs/specs/spec-002.md) — Door, World genesis and fresh purpose-bound entry; [algorithm SPEC-002](../../../docs/algorithms/spec-002.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `door.ts` | required | [read](door.ts.plan.md) |
| `index.ts` | conditional-support | [read](index.ts.plan.md) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `types.ts` | conditional-support | [read](types.ts) |

Shared invariants and dependencies: [repository contract](../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
