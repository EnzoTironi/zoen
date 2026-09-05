// @zoen-plan packages/adapters/src/app-runtime/rivet/index.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/adapters/src/app-runtime/rivet/index.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/adapters/src/app-runtime/rivet/index.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-054](../../../../../docs/specs/spec-054.md).
// Tickets: [ZN-0314](../../../../../docs/tickets/zn-0314.md), [ZN-0315](../../../../../docs/tickets/zn-0315.md), [ZN-0316](../../../../../docs/tickets/zn-0316.md), [ZN-0317](../../../../../docs/tickets/zn-0317.md), [ZN-0318](../../../../../docs/tickets/zn-0318.md).
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
// ### SPEC-054
// Zoen-owned port: PrepareRuntime(artifact,profile,realm) -> PreparedRuntime; ProbeRuntime(preparation) -> Attestation; ResolvePreparedRuntime(binding,session) -> IsolatedTarget; RetireRuntime(slot) -> Result. These are Zoen adapter contracts, not asserted Rivet API names.
//
// jobs.app_runtime_preparations(preparation_id PK,world_id,realm,manifest_digest,artifact_digest,profile_digest,runtime_slot_ref,host_state_partition,attempt_fence,status,attestation_ref,expires_at); jobs.app_runtime_slots(slot_ref PK,immutable_identity,digest,runner_scope,state). Public AppPublicationBinding remains in the released Ontology graph. Runtime process globals/SQLite are not authoritative company data.
//
// [algorithm SPEC-054](../../../../../docs/algorithms/spec-054.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
