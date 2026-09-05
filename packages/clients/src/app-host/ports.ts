// @zoen-plan packages/clients/src/app-host/ports.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/clients/src/app-host/ports.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/clients/src/app-host/ports.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-053](../../../../docs/specs/spec-053.md).
// Tickets: [ZN-0308](../../../../docs/tickets/zn-0308.md), [ZN-0309](../../../../docs/tickets/zn-0309.md), [ZN-0311](../../../../docs/tickets/zn-0311.md).
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
// ### SPEC-053
// BindAppFrame -> BridgeBinding; TransportSemanticCall(binding,request) -> existing SemanticExecutor; CloseAppSession -> close/drain; StageStaticBundle(artifact) -> nonpublic immutable asset ref. Host confirmation invokes existing ActionCase operations.
//
// No business authority store. Host-owned ephemeral bridge state records window identity, session binding, exact guest origin, channel nonce, request sequence, publication/artifact digest and bounded pending calls. Runner state keys include World/realm/principal/purpose/installation/version/session; shared collaboration is separately admitted. Private response/cache state is never keyed only by appId.
//
// [algorithm SPEC-053](../../../../docs/algorithms/spec-053.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
