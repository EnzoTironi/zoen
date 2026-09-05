# packages/door/src/enterprise

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-038](../../../../docs/specs/spec-038.md) — Enterprise SSO, SCIM and workload identity lifecycle; [algorithm SPEC-038](../../../../docs/algorithms/spec-038.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `directory-policy.ts` | required | [read](directory-policy.ts) |
| `enterprise-sso.ts` | required | [read](enterprise-sso.ts) |
| `index.ts` | conditional-support | [read](index.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `scim.ts` | required | [read](scim.ts) |
| `types.ts` | conditional-support | [read](types.ts) |
| `workload-identity.ts` | required | [read](workload-identity.ts) |

Shared invariants and dependencies: [repository contract](../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
