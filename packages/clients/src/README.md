# packages/clients/src

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-026](../../../docs/specs/spec-026.md) — REST, CLI, TypeScript SDK and MCP from one manifest; [algorithm SPEC-026](../../../docs/algorithms/spec-026.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `cli-generation.ts` | required | [read](cli-generation.ts) |
| `cli.ts` | conditional-support | [read](cli.ts.plan.md) |
| `index.ts` | conditional-support | [read](index.ts.plan.md) |
| `mcp.ts` | required | [read](mcp.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `rest-openapi.ts` | required | [read](rest-openapi.ts) |
| `sdk-generation.ts` | required | [read](sdk-generation.ts) |
| `semantic-client.ts` | conditional-support | [read](semantic-client.ts.plan.md) |
| `status-stream.ts` | required | [read](status-stream.ts) |
| `types.ts` | conditional-support | [read](types.ts) |

Shared invariants and dependencies: [repository contract](../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
