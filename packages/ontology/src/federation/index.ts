// @zoen-plan packages/ontology/src/federation/index.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/federation/index.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/federation/index.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-043](../../../../docs/specs/spec-043.md).
// Tickets: [ZN-0250](../../../../docs/tickets/zn-0250.md), [ZN-0251](../../../../docs/tickets/zn-0251.md), [ZN-0252](../../../../docs/tickets/zn-0252.md), [ZN-0253](../../../../docs/tickets/zn-0253.md).
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
