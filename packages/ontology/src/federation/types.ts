// @zoen-plan packages/ontology/src/federation/types.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/federation/types.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/federation/types.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-043](../../../../docs/specs/spec-043.md).
// Tickets: [ZN-0250](../../../../docs/tickets/zn-0250.md), [ZN-0251](../../../../docs/tickets/zn-0251.md), [ZN-0252](../../../../docs/tickets/zn-0252.md), [ZN-0253](../../../../docs/tickets/zn-0253.md).
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
// ### SPEC-043
// OpenFederatedFrame(plan,localGrant,remoteDelegations) -> FederatedFrame; ProposeCoordination(plan) -> CoordinationCase; ObserveParticipant(receipt) -> PartialState; CompensateParticipant(action) -> NewLocalCase.
//
// ontology.federation_links(link_id PK,local_world,remote_world,trust_profile,permitted_ops,rights_contract,expiry); ontology.federated_frames(frame_id PK,component_refs,cuts,rights_basis,skew,gaps); ontology.coordinations(coordination_id PK,world_id,plan_digest,participants,state,outcome); ontology.coordination_parts(coordination_id,participant PK,local_case_ref,receipt_ref,external_state). No shared global grant/token.
//
// [algorithm SPEC-043](../../../../docs/algorithms/spec-043.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
