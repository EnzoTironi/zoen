# packages/ontology/src/flows

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-032](../../../../docs/specs/spec-032.md) — Governed batch, incremental, CDC and stream data flows; [algorithm SPEC-032](../../../../docs/algorithms/spec-032.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `cdc.ts` | required | [read](cdc.ts) |
| `flow-dag.ts` | required | [read](flow-dag.ts) |
| `flow-runner.ts` | required | [read](flow-runner.ts) |
| `index.ts` | conditional-support | [read](index.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `quality-lineage.ts` | required | [read](quality-lineage.ts) |
| `types.ts` | conditional-support | [read](types.ts) |
| `watermarks.ts` | required | [read](watermarks.ts) |

Shared invariants and dependencies: [repository contract](../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
