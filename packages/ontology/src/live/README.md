# packages/ontology/src/live

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-033](../../../../docs/specs/spec-033.md) — Entitled live feeds, gap-aware subscriptions and action capture; [algorithm SPEC-033](../../../../docs/algorithms/spec-033.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `index.ts` | conditional-support | [read](index.ts) |
| `live-capture.ts` | required | [read](live-capture.ts) |
| `live-entitlement.ts` | required | [read](live-entitlement.ts) |
| `live-envelope.ts` | required | [read](live-envelope.ts) |
| `live-seal.ts` | required | [read](live-seal.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `types.ts` | conditional-support | [read](types.ts) |

Shared invariants and dependencies: [repository contract](../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
