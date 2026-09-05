# packages/ontology/src/rights

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-018](../../../../docs/specs/spec-018.md) — Fine-grained rights, delegation and audience-safe disclosure; [algorithm SPEC-018](../../../../docs/algorithms/spec-018.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `app-context.ts` | conditional-support | [read](app-context.ts) |
| `audience-view.ts` | required | [read](audience-view.ts) |
| `cedar-admission.ts` | required | [read](cedar-admission.ts) |
| `delegation.ts` | required | [read](delegation.ts) |
| `derived-rights.ts` | required | [read](derived-rights.ts) |
| `index.ts` | conditional-support | [read](index.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `rights-freshness.ts` | required | [read](rights-freshness.ts) |
| `types.ts` | conditional-support | [read](types.ts) |

Shared invariants and dependencies: [repository contract](../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
