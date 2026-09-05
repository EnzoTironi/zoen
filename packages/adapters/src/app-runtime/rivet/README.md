# packages/adapters/src/app-runtime/rivet

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-054](../../../../../docs/specs/spec-054.md) — Rivet Dynamic Apps Core qualification and immutable runtime adapter; [algorithm SPEC-054](../../../../../docs/algorithms/spec-054.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `index.ts` | conditional-support | [read](index.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `rivet-api-probe.ts` | required | [read](rivet-api-probe.ts) |
| `rivet-binding.ts` | required | [read](rivet-binding.ts) |
| `rivet-host-profile.ts` | required | [read](rivet-host-profile.ts) |
| `rivet-preparation.ts` | required | [read](rivet-preparation.ts) |
| `rivet-recovery.ts` | required | [read](rivet-recovery.ts) |
| `types.ts` | conditional-support | [read](types.ts) |

Shared invariants and dependencies: [repository contract](../../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
