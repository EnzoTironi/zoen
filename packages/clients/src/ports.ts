// @zoen-plan packages/clients/src/ports.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/clients/src/ports.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/clients/src/ports.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-026](../../../docs/specs/spec-026.md).
// Tickets: [ZN-0153](../../../docs/tickets/zn-0153.md), [ZN-0154](../../../docs/tickets/zn-0154.md), [ZN-0155](../../../docs/tickets/zn-0155.md), [ZN-0156](../../../docs/tickets/zn-0156.md), [ZN-0157](../../../docs/tickets/zn-0157.md).
//
// ## Responsibility and reuse
//
// ```text
// CONTRACT SURFACE PLAN.
// DEFINE only the owning module's input/output/error/state and dependency-port types.
// REUSE branded kernel values, verified context, common semantic envelope and typed results.
// DO NOT export repositories or broad credentials to clients; authority context is server verified.
// SEPARATE versioned semantic meaning from transport metadata and immutable artifacts from mutable runtime state.
// VERIFY consumers use the same contracts and exhaustive tagged outcomes; unsupported shapes fail closed.
// ```
//
// ## Owning state / operation contracts
//
// ### SPEC-026
// Discover(world,purpose) -> AuthorizedManifest; Invoke(operationId,contractDigest,input,operationId?) -> Result; GenerateClient(manifest,target) -> ReproducibleClient; NegotiateProtocol(clientVersions) -> SelectedVersion | UnsupportedVersion.
//
// No new authority tables. Generated contracts live in contracts/generated/<release-digest> and include operation IDs, input/output/error schemas, effect class, assurance, compatibility and manifest digest. Protocol edition and generated toolchain versions are separately admitted in execution-lock.json.
//
// [algorithm SPEC-026](../../../docs/algorithms/spec-026.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
