# runners

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-030](../docs/specs/spec-030.md) — Isolated runners, credential brokers and programmable analysis; [algorithm SPEC-030](../docs/algorithms/spec-030.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `analysis-profiles.ts` | required | [read](analysis-profiles.ts) |
| `capability-broker.ts` | required | [read](capability-broker.ts) |
| `index.ts` | conditional-support | [read](index.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `runner-limits.ts` | required | [read](runner-limits.ts) |
| `runner-output.ts` | required | [read](runner-output.ts) |
| `runner-profile.ts` | required | [read](runner-profile.ts) |
| `types.ts` | conditional-support | [read](types.ts) |

Shared invariants and dependencies: [repository contract](../docs/architecture/repository-contract.md). Do not add another data/authorization path.
