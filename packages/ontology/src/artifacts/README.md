# packages/ontology/src/artifacts

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-029](../../../../docs/specs/spec-029.md) — Signed capability artifacts and controlled installation; [algorithm SPEC-029](../../../../docs/algorithms/spec-029.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `artifact-build.ts` | required | [read](artifact-build.ts) |
| `artifact-envelope.ts` | required | [read](artifact-envelope.ts) |
| `artifact-install.ts` | required | [read](artifact-install.ts) |
| `artifact-recall.ts` | required | [read](artifact-recall.ts) |
| `index.ts` | conditional-support | [read](index.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `types.ts` | conditional-support | [read](types.ts) |

Shared invariants and dependencies: [repository contract](../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
