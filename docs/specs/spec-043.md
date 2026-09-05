# SPEC-043 — Federated Frames, independent approvals and partial global outcomes

**Milestone:** S10 · **Owner:** Platform Kernel · **Root:** `packages/ontology/src/federation`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Independent Worlds retain independent truth, policy, cuts and authority. A federated result is a vector of component bases with skew/gaps, not a global ACID snapshot. Cross-World actions coordinate local Cases and disclose partial outcomes honestly.

## Owned state and storage contract
ontology.federation_links(link_id PK,local_world,remote_world,trust_profile,permitted_ops,rights_contract,expiry); ontology.federated_frames(frame_id PK,component_refs,cuts,rights_basis,skew,gaps); ontology.coordinations(coordination_id PK,world_id,plan_digest,participants,state,outcome); ontology.coordination_parts(coordination_id,participant PK,local_case_ref,receipt_ref,external_state). No shared global grant/token.

## Operations

```text
OpenFederatedFrame(plan,localGrant,remoteDelegations) -> FederatedFrame; ProposeCoordination(plan) -> CoordinationCase; ObserveParticipant(receipt) -> PartialState; CompensateParticipant(action) -> NewLocalCase.
```

## Execution protocol
Authenticate remote service and principal-bound delegated purpose independently. Reauthorize each component and retain its licenses/retention on derived data. Missing/late participants stay explicit. Each participant commits locally under its own policy and guards. Global budgets/inventory require one designated owner or explicit partitioned reservations; do not infer atomic global conservation from messages.

## Pseudocode and file ownership

[algorithm SPEC-043](../algorithms/spec-043.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0250](../tickets/zn-0250.md) | Implement explicit federation trust and delegation contracts | component | [ZN-0134](../tickets/zn-0134.md), [ZN-0139](../tickets/zn-0139.md), [ZN-0158](../tickets/zn-0158.md), [ZN-0249](../tickets/zn-0249.md) |
| [ZN-0251](../tickets/zn-0251.md) | Build independent-cut federated Frames | component | [ZN-0250](../tickets/zn-0250.md) |
| [ZN-0252](../tickets/zn-0252.md) | Coordinate independent local ActionCases | component | [ZN-0251](../tickets/zn-0251.md) |
| [ZN-0253](../tickets/zn-0253.md) | Implement compensation and globally owned resources | component | [ZN-0252](../tickets/zn-0252.md) |
| [ZN-0254](../tickets/zn-0254.md) | Prove federated revocation, skew and partial outcomes | chaos | [ZN-0253](../tickets/zn-0253.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `deployment-cells-and-federation.md`, `rights-and-access-control.md`. Read a named historical reference only when needed; it cannot override current contracts.
