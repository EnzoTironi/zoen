# packages/ontology/src/attention

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-020](../../../../docs/specs/spec-020.md) — Semantic Watches, Notices and quiet attention; [algorithm SPEC-020](../../../../docs/algorithms/spec-020.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `attention-policy.ts` | required | [read](attention-policy.ts) |
| `index.ts` | conditional-support | [read](index.ts) |
| `notice-disclosure.ts` | required | [read](notice-disclosure.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `types.ts` | conditional-support | [read](types.ts) |
| `watch-contract.ts` | required | [read](watch-contract.ts) |
| `watch-evaluator.ts` | required | [read](watch-evaluator.ts) |
| `watch-inspector.ts` | required | [read](watch-inspector.ts) |

Shared invariants and dependencies: [repository contract](../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
