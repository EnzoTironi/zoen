# packages/ontology/src/authority

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-003](../../../../docs/specs/spec-003.md) — Atomic authority, domain guards and durable handoff; [algorithm SPEC-003](../../../../docs/algorithms/spec-003.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `guards.ts` | required | [read](guards.ts.plan.md) |
| `idempotency.ts` | required | [read](idempotency.ts) |
| `index.ts` | conditional-support | [read](index.ts) |
| `outbox.ts` | required | [read](outbox.ts.plan.md) |
| `plan.ts` | conditional-support | [read](plan.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `schema.ts` | required | [read](schema.ts) |
| `states.ts` | conditional-support | [read](states.ts.plan.md) |
| `transaction.ts` | required | [read](transaction.ts.plan.md) |
| `types.ts` | conditional-support | [read](types.ts) |

Shared invariants and dependencies: [repository contract](../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
