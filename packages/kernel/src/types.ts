// @zoen-plan packages/kernel/src/types.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/kernel/src/types.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/kernel/src/types.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-001](../../../docs/specs/spec-001.md).
// Tickets: [ZN-0007](../../../docs/tickets/zn-0007.md), [ZN-0008](../../../docs/tickets/zn-0008.md), [ZN-0009](../../../docs/tickets/zn-0009.md), [ZN-0010](../../../docs/tickets/zn-0010.md), [ZN-0011](../../../docs/tickets/zn-0011.md), [ZN-0012](../../../docs/tickets/zn-0012.md).
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
// ### SPEC-001
// parseEnvelope(bytes) -> ValidEnvelope | InvalidInput; normalizeDecimal(text, scalePolicy) -> Decimal | InvalidScalar; compareIntervals(a,b) -> ComparableInterval | NonComparable; canonicalDigest(value) -> sha256.
//
// No tables. Normative JSON schemas live under contracts/kernel. IDs are opaque UUID values tagged at runtime with world/realm; counters and monetary values cross JSON as decimal strings. Database identifiers must not be guessable credentials.
//
// [algorithm SPEC-001](../../../docs/algorithms/spec-001.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
