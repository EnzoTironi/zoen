# File plan — `runbooks/spec-043/federation-journey.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-043/federation-journey.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-043](../../docs/specs/spec-043.md).
Tickets: [ZN-0254](../../docs/tickets/zn-0254.md).

## Responsibility and reuse

## ZN-0254 operational/repair procedure

Scope: Prove federated revocation, skew and partial outcomes. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
The journey resumes
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
VERIFY remote service identity and principal-bound delegated purpose independently at each World.
REQUEST each component Frame through its normal semantic surface and current source/license restrictions.
BUILD federated Frame retaining separate cuts, time skew, gaps and inherited rights; no global grant.
PROPOSE coordination as explicit participant plans with independent local approvals and guards.
COMMIT each participant locally; record accepted/rejected/unknown separately and derive honest partial global outcome.
CONSERVE global budget/inventory through designated ownership or pre-partitioned reservations, not messaging assumptions.
RETRY/reconcile stable participant identities; compensation is a new local ActionCase.
ON revocation or participant loss stop unauthorized future disclosure/work while preserving already observed receipts.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
Further unauthorized disclosure stops within the declared distributed freshness contract and partial local outcomes remain explicit
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-043
OpenFederatedFrame(plan,localGrant,remoteDelegations) -> FederatedFrame; ProposeCoordination(plan) -> CoordinationCase; ObserveParticipant(receipt) -> PartialState; CompensateParticipant(action) -> NewLocalCase.

ontology.federation_links(link_id PK,local_world,remote_world,trust_profile,permitted_ops,rights_contract,expiry); ontology.federated_frames(frame_id PK,component_refs,cuts,rights_basis,skew,gaps); ontology.coordinations(coordination_id PK,world_id,plan_digest,participants,state,outcome); ontology.coordination_parts(coordination_id,participant PK,local_case_ref,receipt_ref,external_state). No shared global grant/token.

[algorithm SPEC-043](../../docs/algorithms/spec-043.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
