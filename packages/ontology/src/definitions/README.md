# packages/ontology/src/definitions

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-013](../../../../docs/specs/spec-013.md) — Bounded ontology grammar and deterministic release compiler; [algorithm SPEC-013](../../../../docs/algorithms/spec-013.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `capability-definitions.ts` | required | [read](capability-definitions.ts) |
| `compiler-laws.ts` | required | [read](compiler-laws.ts) |
| `compiler.ts` | required | [read](compiler.ts) |
| `expression-ir.ts` | required | [read](expression-ir.ts) |
| `expression.ts` | conditional-support | [read](expression.ts.plan.md) |
| `index.ts` | conditional-support | [read](index.ts) |
| `ontology-grammar.ts` | required | [read](ontology-grammar.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `semantic-diff.ts` | required | [read](semantic-diff.ts) |
| `standards.ts` | required | [read](standards.ts) |
| `types.ts` | conditional-support | [read](types.ts) |

Shared invariants and dependencies: [repository contract](../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
