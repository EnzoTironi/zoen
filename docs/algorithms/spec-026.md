# SPEC-026 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-026](../specs/spec-026.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Developer Platform**. Module: `packages/clients/src`. Milestone: **S5**.

## Normative operation signatures

```text
Discover(world,purpose) -> AuthorizedManifest; Invoke(operationId,contractDigest,input,operationId?) -> Result; GenerateClient(manifest,target) -> ReproducibleClient; NegotiateProtocol(clientVersions) -> SelectedVersion | UnsupportedVersion.
```

## State and transaction contract

No new authority tables. Generated contracts live in contracts/generated/<release-digest> and include operation IDs, input/output/error schemas, effect class, assurance, compatibility and manifest digest. Protocol edition and generated toolchain versions are separately admitted in execution-lock.json.

## Shared algorithm

```text
DISCOVER operations through the existing authorized semantic executor.
VALIDATE manifest contract/release digests and admitted protocol editions before generating clients.
GENERATE REST/OpenAPI, CLI, TypeScript and MCP descriptors deterministically from the same schemas.
PRESERVE semantic operation ID, input digest, basis, purpose and idempotency identity across adapters.
NEVER accept annotations/tool approvals as authorization; server verifies every invocation.
ON incompatible schema/meaning return ContractChanged rather than coercing consequential input.
FOR async results, cursors, exports and reconnects use opaque references plus current authorization.
TEST normalized semantic parity, not identical prose, and do not invent runtime changes to previously compiled static types.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0153](../tickets/zn-0153.md) | Generate REST/OpenAPI contracts and endpoint adapters | [packages/clients/src/rest-openapi.ts](../../packages/clients/src/rest-openapi.ts) |
| [ZN-0154](../tickets/zn-0154.md) | Generate CLI commands and structured failure behavior | [packages/clients/src/cli-generation.ts](../../packages/clients/src/cli-generation.ts) |
| [ZN-0155](../tickets/zn-0155.md) | Generate static TypeScript SDKs and compatibility checks | [packages/clients/src/sdk-generation.ts](../../packages/clients/src/sdk-generation.ts) |
| [ZN-0156](../tickets/zn-0156.md) | Implement MCP tools, resources and authorization negotiation | [packages/clients/src/mcp.ts](../../packages/clients/src/mcp.ts) |
| [ZN-0157](../tickets/zn-0157.md) | Implement resumable status streams with rights refresh | [packages/clients/src/status-stream.ts](../../packages/clients/src/status-stream.ts) |
| [ZN-0158](../tickets/zn-0158.md) | Prove cross-surface semantic and error parity | [tests/journey/spec-026/surface-conformance.test.ts](../../tests/journey/spec-026/surface-conformance.test.ts) |

## Required proof boundaries

Generate REST/OpenAPI 3.1, CLI JSON modes, TypeScript definitions and MCP tools/resources from the same schemas. Every invocation still authorizes server-side. Reject incompatible operation digest rather than silently adapting consequential input. MCP annotations/tool approval are hints, not permission. Long operations use admitted status/SSE protocols with fresh authorization on reconnect.

V4 refinement: REST, CLI, SDK, MCP, Eve and mini-app clients are transport adapters for SPEC-007. They preserve the operation, current context, exact basis and idempotency identity; they do not duplicate policy logic. The simple semantic client is available before S5; these tickets add full generated surfaces.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
