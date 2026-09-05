# packages/ontology/src/releases

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-014](../../../../docs/specs/spec-014.md) — Runtime change governance, evaluation, preparation and activation; [algorithm SPEC-014](../../../../docs/algorithms/spec-014.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `activate.ts` | required | [read](activate.ts) |
| `app-bindings.ts` | conditional-support | [read](app-bindings.ts) |
| `change-lanes.ts` | required | [read](change-lanes.ts) |
| `evaluation-world.ts` | required | [read](evaluation-world.ts) |
| `index.ts` | conditional-support | [read](index.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `prepare.ts` | required | [read](prepare.ts) |
| `proof.ts` | required | [read](proof.ts) |
| `rebase.ts` | required | [read](rebase.ts) |
| `types.ts` | conditional-support | [read](types.ts) |

Shared invariants and dependencies: [repository contract](../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
