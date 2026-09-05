# File plan — `runbooks/spec-026/sdk-generation.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-026/sdk-generation.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-026](../../docs/specs/spec-026.md).
Tickets: [ZN-0155](../../docs/tickets/zn-0155.md).

## Responsibility and reuse

## ZN-0155 operational/repair procedure

Scope: Generate static TypeScript SDKs and compatibility checks. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
The old client calls the operation
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
DISCOVER operations through the existing authorized semantic executor.
VALIDATE manifest contract/release digests and admitted protocol editions before generating clients.
GENERATE REST/OpenAPI, CLI, TypeScript and MCP descriptors deterministically from the same schemas.
PRESERVE semantic operation ID, input digest, basis, purpose and idempotency identity across adapters.
NEVER accept annotations/tool approvals as authorization; server verifies every invocation.
ON incompatible schema/meaning return ContractChanged rather than coercing consequential input.
FOR async results, cursors, exports and reconnects use opaque references plus current authorization.
TEST normalized semantic parity, not identical prose, and do not invent runtime changes to previously compiled static types.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
The call fails explicitly; its old static types are not falsely presented as updated at runtime
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-026
Discover(world,purpose) -> AuthorizedManifest; Invoke(operationId,contractDigest,input,operationId?) -> Result; GenerateClient(manifest,target) -> ReproducibleClient; NegotiateProtocol(clientVersions) -> SelectedVersion | UnsupportedVersion.

No new authority tables. Generated contracts live in contracts/generated/<release-digest> and include operation IDs, input/output/error schemas, effect class, assurance, compatibility and manifest digest. Protocol edition and generated toolchain versions are separately admitted in execution-lock.json.

[algorithm SPEC-026](../../docs/algorithms/spec-026.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
