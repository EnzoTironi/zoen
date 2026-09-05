# packages/eve/src/turns

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-009](../../../../docs/specs/spec-009.md) — Eve fenced turn machine and visible-message recovery; [algorithm SPEC-009](../../../../docs/algorithms/spec-009.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `index.ts` | conditional-support | [read](index.ts) |
| `model-attempt.ts` | required | [read](model-attempt.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `stream.ts` | required | [read](stream.ts) |
| `tool-dispatch.ts` | required | [read](tool-dispatch.ts) |
| `turn-stop.ts` | required | [read](turn-stop.ts) |
| `turn-store.ts` | required | [read](turn-store.ts) |
| `types.ts` | conditional-support | [read](types.ts) |

Shared invariants and dependencies: [repository contract](../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
