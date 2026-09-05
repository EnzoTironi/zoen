# packages/ontology/src/compute

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-034](../../../../docs/specs/spec-034.md) — Virtual sources and distributed/GPU compute adapters; [algorithm SPEC-034](../../../../docs/algorithms/spec-034.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `compute-output.ts` | required | [read](compute-output.ts) |
| `distributed-contract.ts` | required | [read](distributed-contract.ts) |
| `index.ts` | conditional-support | [read](index.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `remote-query.ts` | required | [read](remote-query.ts) |
| `types.ts` | conditional-support | [read](types.ts) |
| `virtual-source.ts` | required | [read](virtual-source.ts) |

Shared invariants and dependencies: [repository contract](../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
