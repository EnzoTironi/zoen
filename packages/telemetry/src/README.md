# packages/telemetry/src

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-008](../../../docs/specs/spec-008.md) — Baseline observability, local operations and safe migration preparation; [algorithm SPEC-008](../../../docs/algorithms/spec-008.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `index.ts` | conditional-support | [read](index.ts.plan.md) |
| `legacy-import.ts` | required | [read](legacy-import.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `readiness.ts` | required | [read](readiness.ts) |
| `redaction.ts` | required | [read](redaction.ts) |
| `types.ts` | conditional-support | [read](types.ts) |

Shared invariants and dependencies: [repository contract](../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
