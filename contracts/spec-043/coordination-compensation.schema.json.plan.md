# File plan — `contracts/spec-043/coordination-compensation.schema.json`

**Status:** planned; no product acceptance implied.

Target: `contracts/spec-043/coordination-compensation.schema.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-043](../../docs/specs/spec-043.md).
Tickets: [ZN-0253](../../docs/tickets/zn-0253.md).

## Responsibility and reuse

```text
CONDITIONAL SCHEMA PLAN — no permissive {} schema or fabricated generated types.
RESOLVE exact input/output/tagged-error fields from the operation signatures and common protocol.
REQUIRE bounded sizes/depth/arrays, exact discriminants, validated IDs and explicit optional/null distinctions.
REJECT additional or authority-bearing client fields; money/counters stay strings where required.
GENERATE canonical fixtures, wire types and surface descriptors from this single reviewed schema source.
TEST malformed/oversized/unknown-version inputs and exact round trips; registry presence alone is not a pass.
```

## Owning state / operation contracts

### SPEC-043
OpenFederatedFrame(plan,localGrant,remoteDelegations) -> FederatedFrame; ProposeCoordination(plan) -> CoordinationCase; ObserveParticipant(receipt) -> PartialState; CompensateParticipant(action) -> NewLocalCase.

ontology.federation_links(link_id PK,local_world,remote_world,trust_profile,permitted_ops,rights_contract,expiry); ontology.federated_frames(frame_id PK,component_refs,cuts,rights_basis,skew,gaps); ontology.coordinations(coordination_id PK,world_id,plan_digest,participants,state,outcome); ontology.coordination_parts(coordination_id,participant PK,local_case_ref,receipt_ref,external_state). No shared global grant/token.

[algorithm SPEC-043](../../docs/algorithms/spec-043.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
