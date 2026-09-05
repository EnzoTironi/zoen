# packages/ontology/src/surfaces

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-007](../../../../docs/specs/spec-007.md) — WorldFrames and the first semantic surface; [algorithm SPEC-007](../../../../docs/algorithms/spec-007.md)
- [SPEC-050](../../../../docs/specs/spec-050.md) — One semantic executor and transport-only client contract; [algorithm SPEC-050](../../../../docs/algorithms/spec-050.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `bounded-reads.ts` | required | [read](bounded-reads.ts) |
| `discovery.ts` | required | [read](discovery.ts) |
| `dispatch.ts` | required | [read](dispatch.ts.plan.md) |
| `effective-context.ts` | required | [read](effective-context.ts) |
| `executor-binding.ts` | required | [read](executor-binding.ts) |
| `frame-basis.ts` | required | [read](frame-basis.ts) |
| `frame-disclosure.ts` | required | [read](frame-disclosure.ts) |
| `index.ts` | conditional-support | [read](index.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `registry.ts` | conditional-support | [read](registry.ts.plan.md) |
| `streaming-path.ts` | required | [read](streaming-path.ts) |
| `types.ts` | conditional-support | [read](types.ts) |

Shared invariants and dependencies: [repository contract](../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
