// @zoen-plan packages/kernel/src/index.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/kernel/src/index.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/kernel/src/index.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-000](../../../docs/specs/spec-000.md), [SPEC-001](../../../docs/specs/spec-001.md).
// Tickets: [ZN-0003](../../../docs/tickets/zn-0003.md), [ZN-0007](../../../docs/tickets/zn-0007.md), [ZN-0008](../../../docs/tickets/zn-0008.md), [ZN-0009](../../../docs/tickets/zn-0009.md), [ZN-0010](../../../docs/tickets/zn-0010.md), [ZN-0011](../../../docs/tickets/zn-0011.md), [ZN-0012](../../../docs/tickets/zn-0012.md).
//
// ## Responsibility and reuse
//
// ```text
// COMPOSITION/REGISTRATION PLAN.
// IMPORT only reviewed implemented ports and adapters under the existing dependency direction.
// BIND the existing semantic executor once; register this module's released operation descriptors.
// DO NOT add business rules, source credentials, alternate policy evaluators or a second dispatcher here.
// GATE unavailable capabilities explicitly; an unwired implementation does not satisfy a ticket.
// KEEP shared composition edits under the named exclusive lock.
// ```
//
// ## Owning state / operation contracts
//
// ### SPEC-000
// AdmitExecutionProfile(profile, candidateVersions, integrityDigests, compatibilityReport) -> AdmittedLock | Blocked; VerifyTicket(ticketId, commit, profile) -> EvidenceReport | MissingPrerequisite.
//
// No application tables. Track execution-lock.json, baseline-inventory.json and evidence-index.json as reviewed artifacts. Secret values never belong in these files.
//
// [algorithm SPEC-000](../../../docs/algorithms/spec-000.md)
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
