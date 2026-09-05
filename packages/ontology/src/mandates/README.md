# packages/ontology/src/mandates

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-024](../../../../docs/specs/spec-024.md) — Budget conservation, bounded Mandates and observed outcomes; [algorithm SPEC-024](../../../../docs/algorithms/spec-024.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `index.ts` | conditional-support | [read](index.ts) |
| `mandate-contract.ts` | required | [read](mandate-contract.ts) |
| `mandate-stop.ts` | required | [read](mandate-stop.ts) |
| `outcome-observation.ts` | required | [read](outcome-observation.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `reservations.ts` | required | [read](reservations.ts) |
| `types.ts` | conditional-support | [read](types.ts) |

Shared invariants and dependencies: [repository contract](../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
