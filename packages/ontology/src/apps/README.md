# packages/ontology/src/apps

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-052](../../../../docs/specs/spec-052.md) — Early declarative mini apps as released data; [algorithm SPEC-052](../../../../docs/algorithms/spec-052.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `app-bindings.ts` | required | [read](app-bindings.ts) |
| `app-definition.ts` | required | [read](app-definition.ts) |
| `app-lifecycle.ts` | required | [read](app-lifecycle.ts) |
| `app-publication.ts` | required | [read](app-publication.ts) |
| `index.ts` | conditional-support | [read](index.ts) |
| `manifest.ts` | conditional-support | [read](manifest.ts.plan.md) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `session-constraints.ts` | conditional-support | [read](session-constraints.ts.plan.md) |
| `types.ts` | conditional-support | [read](types.ts) |

Shared invariants and dependencies: [repository contract](../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
