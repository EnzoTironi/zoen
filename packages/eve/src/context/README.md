# packages/eve/src/context

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-010](../../../../docs/specs/spec-010.md) — Context, grounded composition, model routing and voice; [algorithm SPEC-010](../../../../docs/algorithms/spec-010.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `compaction.ts` | required | [read](compaction.ts) |
| `compile-context.ts` | required | [read](compile-context.ts) |
| `composition.ts` | required | [read](composition.ts) |
| `index.ts` | conditional-support | [read](index.ts) |
| `model-routing.ts` | required | [read](model-routing.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `types.ts` | conditional-support | [read](types.ts) |
| `voice.ts` | required | [read](voice.ts) |

Shared invariants and dependencies: [repository contract](../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
