# packages/ontology/src/packs

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-037](../../../../docs/specs/spec-037.md) — Pack registry, overlays, upgrades and marketplace governance; [algorithm SPEC-037](../../../../docs/algorithms/spec-037.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `index.ts` | conditional-support | [read](index.ts) |
| `pack-overlays.ts` | required | [read](pack-overlays.ts) |
| `pack-registry.ts` | required | [read](pack-registry.ts) |
| `pack-upgrade.ts` | required | [read](pack-upgrade.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `publisher-governance.ts` | required | [read](publisher-governance.ts) |
| `types.ts` | conditional-support | [read](types.ts) |

Shared invariants and dependencies: [repository contract](../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
