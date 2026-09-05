# packages/kernel/src

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-001](../../../docs/specs/spec-001.md) — Kernel values, contract algebra and canonical encoding; [algorithm SPEC-001](../../../docs/algorithms/spec-001.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `decimal.ts` | required | [read](decimal.ts.plan.md) |
| `graph.ts` | conditional-support | [read](graph.ts.plan.md) |
| `ids.ts` | required | [read](ids.ts.plan.md) |
| `index.ts` | conditional-support | [read](index.ts.plan.md) |
| `json.ts` | required | [read](json.ts.plan.md) |
| `laws.ts` | required | [read](laws.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `result.ts` | required | [read](result.ts.plan.md) |
| `time.ts` | required | [read](time.ts.plan.md) |
| `types.ts` | conditional-support | [read](types.ts) |

Shared invariants and dependencies: [repository contract](../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
