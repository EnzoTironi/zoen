# packages/ontology/src/sources

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-015](../../../../docs/specs/spec-015.md) — Source inventory, OAuth bindings and declarative integration plans; [algorithm SPEC-015](../../../../docs/algorithms/spec-015.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `checkpoints.ts` | required | [read](checkpoints.ts) |
| `drift-acl.ts` | required | [read](drift-acl.ts) |
| `http-plan.ts` | required | [read](http-plan.ts) |
| `index.ts` | conditional-support | [read](index.ts) |
| `inventory.ts` | required | [read](inventory.ts) |
| `oauth-binding.ts` | required | [read](oauth-binding.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `tombstones.ts` | required | [read](tombstones.ts) |
| `types.ts` | conditional-support | [read](types.ts) |

Shared invariants and dependencies: [repository contract](../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
