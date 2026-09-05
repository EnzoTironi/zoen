# packages/ontology/src/evidence

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-004](../../../../docs/specs/spec-004.md) — Retained evidence and file-based source admission; [algorithm SPEC-004](../../../../docs/algorithms/spec-004.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `admission.ts` | required | [read](admission.ts) |
| `capture-gc.ts` | required | [read](capture-gc.ts) |
| `capture.ts` | required | [read](capture.ts) |
| `evidence-read.ts` | required | [read](evidence-read.ts) |
| `extract.ts` | required | [read](extract.ts) |
| `index.ts` | conditional-support | [read](index.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `types.ts` | conditional-support | [read](types.ts) |

Shared invariants and dependencies: [repository contract](../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
