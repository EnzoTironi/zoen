# packages/ontology/src/cells

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-042](../../../../docs/specs/spec-042.md) — Fenced cell migration and single-writer authority epochs; [algorithm SPEC-042](../../../../docs/algorithms/spec-042.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `cell-directory.ts` | required | [read](cell-directory.ts) |
| `epoch-promotion.ts` | required | [read](epoch-promotion.ts) |
| `index.ts` | conditional-support | [read](index.ts) |
| `migration-stage.ts` | required | [read](migration-stage.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `source-fence.ts` | required | [read](source-fence.ts) |
| `types.ts` | conditional-support | [read](types.ts) |

Shared invariants and dependencies: [repository contract](../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
