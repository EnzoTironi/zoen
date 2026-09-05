# apps/web/src/living-world

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-027](../../../../docs/specs/spec-027.md) — Living World charts, tables, timelines and safe Focus; [algorithm SPEC-027](../../../../docs/algorithms/spec-027.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `index.ts` | conditional-support | [read](index.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `types.ts` | conditional-support | [read](types.ts) |
| `view-contracts.ts` | required | [read](view-contracts.ts) |
| `view-export.ts` | required | [read](view-export.ts) |

Shared invariants and dependencies: [repository contract](../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
