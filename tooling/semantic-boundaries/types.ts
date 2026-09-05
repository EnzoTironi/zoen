// @zoen-plan tooling/semantic-boundaries/types.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `tooling/semantic-boundaries/types.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `tooling/semantic-boundaries/types.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-050](../../docs/specs/spec-050.md).
// Tickets: [ZN-0292](../../docs/tickets/zn-0292.md).
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
// ### SPEC-050
// SemanticCall(envelope, verifiedRequestContext) -> tagged SemanticResult. Discover, Inspect, Propose, AnswerCase, Commit, Subscribe, Export and admitted Analysis are released operation families, not free-form repository methods.
//
// No new authority store. Reuse operation registry, grants, read guards, ActionCases, receipts and outbox. Descriptor/cache keys bind world, principal, delegation, app binding, purpose, release, query digest, cut and security revision. Cursor/chunk handles are references, not bearer permits.
//
// [algorithm SPEC-050](../../docs/algorithms/spec-050.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
