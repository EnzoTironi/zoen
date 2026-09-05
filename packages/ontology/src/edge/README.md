# packages/ontology/src/edge

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-044](../../../../docs/specs/spec-044.md) — Offline child scopes, self-hosted equivalence and fleet policy; [algorithm SPEC-044](../../../../docs/algorithms/spec-044.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `fleet-policy.ts` | required | [read](fleet-policy.ts) |
| `index.ts` | conditional-support | [read](index.ts) |
| `offline-execution.ts` | required | [read](offline-execution.ts) |
| `offline-lease.ts` | required | [read](offline-lease.ts) |
| `offline-reconcile.ts` | required | [read](offline-reconcile.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `self-hosted.ts` | required | [read](self-hosted.ts) |
| `types.ts` | conditional-support | [read](types.ts) |

Shared invariants and dependencies: [repository contract](../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
