# packages/ontology/src/scenarios

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-036](../../../../docs/specs/spec-036.md) — Read-only scenarios, notebooks and evaluated model artifacts; [algorithm SPEC-036](../../../../docs/algorithms/spec-036.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `index.ts` | conditional-support | [read](index.ts) |
| `model-registry.ts` | required | [read](model-registry.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `scenario-apply.ts` | required | [read](scenario-apply.ts) |
| `scenario-compare.ts` | required | [read](scenario-compare.ts) |
| `scenario-store.ts` | required | [read](scenario-store.ts) |
| `training-manifest.ts` | required | [read](training-manifest.ts) |
| `types.ts` | conditional-support | [read](types.ts) |

Shared invariants and dependencies: [repository contract](../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
