# SPEC-043 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-043](../specs/spec-043.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Platform Kernel**. Module: `packages/ontology/src/federation`. Milestone: **S10**.

## Normative operation signatures

```text
OpenFederatedFrame(plan,localGrant,remoteDelegations) -> FederatedFrame; ProposeCoordination(plan) -> CoordinationCase; ObserveParticipant(receipt) -> PartialState; CompensateParticipant(action) -> NewLocalCase.
```

## State and transaction contract

ontology.federation_links(link_id PK,local_world,remote_world,trust_profile,permitted_ops,rights_contract,expiry); ontology.federated_frames(frame_id PK,component_refs,cuts,rights_basis,skew,gaps); ontology.coordinations(coordination_id PK,world_id,plan_digest,participants,state,outcome); ontology.coordination_parts(coordination_id,participant PK,local_case_ref,receipt_ref,external_state). No shared global grant/token.

## Shared algorithm

```text
VERIFY remote service identity and principal-bound delegated purpose independently at each World.
REQUEST each component Frame through its normal semantic surface and current source/license restrictions.
BUILD federated Frame retaining separate cuts, time skew, gaps and inherited rights; no global grant.
PROPOSE coordination as explicit participant plans with independent local approvals and guards.
COMMIT each participant locally; record accepted/rejected/unknown separately and derive honest partial global outcome.
CONSERVE global budget/inventory through designated ownership or pre-partitioned reservations, not messaging assumptions.
RETRY/reconcile stable participant identities; compensation is a new local ActionCase.
ON revocation or participant loss stop unauthorized future disclosure/work while preserving already observed receipts.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0250](../tickets/zn-0250.md) | Implement explicit federation trust and delegation contracts | [packages/ontology/src/federation/federation-links.ts](../../packages/ontology/src/federation/federation-links.ts) |
| [ZN-0251](../tickets/zn-0251.md) | Build independent-cut federated Frames | [packages/ontology/src/federation/federated-read.ts](../../packages/ontology/src/federation/federated-read.ts) |
| [ZN-0252](../tickets/zn-0252.md) | Coordinate independent local ActionCases | [packages/ontology/src/federation/coordination.ts](../../packages/ontology/src/federation/coordination.ts) |
| [ZN-0253](../tickets/zn-0253.md) | Implement compensation and globally owned resources | [packages/ontology/src/federation/coordination-compensation.ts](../../packages/ontology/src/federation/coordination-compensation.ts) |
| [ZN-0254](../tickets/zn-0254.md) | Prove federated revocation, skew and partial outcomes | [tests/chaos/spec-043/federation-journey.test.ts](../../tests/chaos/spec-043/federation-journey.test.ts) |

## Required proof boundaries

Authenticate remote service and principal-bound delegated purpose independently. Reauthorize each component and retain its licenses/retention on derived data. Missing/late participants stay explicit. Each participant commits locally under its own policy and guards. Global budgets/inventory require one designated owner or explicit partitioned reservations; do not infer atomic global conservation from messages.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
