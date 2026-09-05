# packs/clinic

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-021](../../docs/specs/spec-021.md) — Dental operations pack with clinical separation; [algorithm SPEC-021](../../docs/algorithms/spec-021.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `pack.json` | conditional-support | [read](pack.json.plan.md) |

Shared invariants and dependencies: [repository contract](../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
