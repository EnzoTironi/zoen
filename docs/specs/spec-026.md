# SPEC-026 — REST, CLI, TypeScript SDK and MCP from one manifest

**Milestone:** S5 · **Owner:** Developer Platform · **Root:** `packages/clients/src`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
One SurfaceManifest is the semantic contract. Clients are views and transports, never second policy/meaning engines. Runtime discovery changes without a deploy; static types describe the release against which the SDK was generated.

## Owned state and storage contract
No new authority tables. Generated contracts live in contracts/generated/<release-digest> and include operation IDs, input/output/error schemas, effect class, assurance, compatibility and manifest digest. Protocol edition and generated toolchain versions are separately admitted in execution-lock.json.

## Operations

```text
Discover(world,purpose) -> AuthorizedManifest; Invoke(operationId,contractDigest,input,operationId?) -> Result; GenerateClient(manifest,target) -> ReproducibleClient; NegotiateProtocol(clientVersions) -> SelectedVersion | UnsupportedVersion.
```

## Execution protocol
Generate REST/OpenAPI 3.1, CLI JSON modes, TypeScript definitions and MCP tools/resources from the same schemas. Every invocation still authorizes server-side. Reject incompatible operation digest rather than silently adapting consequential input. MCP annotations/tool approval are hints, not permission. Long operations use admitted status/SSE protocols with fresh authorization on reconnect.

V4 refinement: REST, CLI, SDK, MCP, Eve and mini-app clients are transport adapters for SPEC-007. They preserve the operation, current context, exact basis and idempotency identity; they do not duplicate policy logic. The simple semantic client is available before S5; these tickets add full generated surfaces.

V4 normative detail: [single semantic path](../architecture/semantic-path.md).

## Pseudocode and file ownership

[algorithm SPEC-026](../algorithms/spec-026.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0153](../tickets/zn-0153.md) | Generate REST/OpenAPI contracts and endpoint adapters | component | [ZN-0081](../tickets/zn-0081.md), [ZN-0111](../tickets/zn-0111.md), [ZN-0152](../tickets/zn-0152.md) |
| [ZN-0154](../tickets/zn-0154.md) | Generate CLI commands and structured failure behavior | component | [ZN-0153](../tickets/zn-0153.md) |
| [ZN-0155](../tickets/zn-0155.md) | Generate static TypeScript SDKs and compatibility checks | component | [ZN-0154](../tickets/zn-0154.md) |
| [ZN-0156](../tickets/zn-0156.md) | Implement MCP tools, resources and authorization negotiation | component | [ZN-0155](../tickets/zn-0155.md) |
| [ZN-0157](../tickets/zn-0157.md) | Implement resumable status streams with rights refresh | component | [ZN-0156](../tickets/zn-0156.md) |
| [ZN-0158](../tickets/zn-0158.md) | Prove cross-surface semantic and error parity | journey | [ZN-0157](../tickets/zn-0157.md), [ZN-0293](../tickets/zn-0293.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `interfaces-sdk-and-mcp.md`, `ontology-and-standards.md`. Read a named historical reference only when needed; it cannot override current contracts.
