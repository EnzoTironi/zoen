# packages/clients/src/app-host

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-053](../../../../docs/specs/spec-053.md) — Isolated app host and transport-only bridge; [algorithm SPEC-053](../../../../docs/algorithms/spec-053.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `app-origins.ts` | required | [read](app-origins.ts) |
| `bridge-transport.ts` | required | [read](bridge-transport.ts) |
| `host-revocation.ts` | required | [read](host-revocation.ts) |
| `index.ts` | conditional-support | [read](index.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `types.ts` | conditional-support | [read](types.ts) |

Shared invariants and dependencies: [repository contract](../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
