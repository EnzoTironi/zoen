# packages/ontology/src/datasets

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-031](../../../../docs/specs/spec-031.md) — Dense Parquet/Iceberg datasets and atomic publication; [algorithm SPEC-031](../../../../docs/algorithms/spec-031.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `dataset-pins.ts` | required | [read](dataset-pins.ts) |
| `dataset-publish.ts` | required | [read](dataset-publish.ts) |
| `dataset-read.ts` | required | [read](dataset-read.ts) |
| `dataset-stage.ts` | required | [read](dataset-stage.ts) |
| `dense-profile.ts` | required | [read](dense-profile.ts) |
| `index.ts` | conditional-support | [read](index.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `types.ts` | conditional-support | [read](types.ts) |

Shared invariants and dependencies: [repository contract](../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
