# File plan — `db/migrations/zn-0253_coordination-compensation.sql`

**Status:** planned; no product acceptance implied.

Target: `db/migrations/zn-0253_coordination-compensation.sql`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-043](../../docs/specs/spec-043.md).
Tickets: [ZN-0253](../../docs/tickets/zn-0253.md).

## Responsibility and reuse

```text
CONDITIONAL MIGRATION PLAN — never feed this Markdown to a migrator.
IF no durable invariant is introduced by the owning ticket: do not create a no-op SQL migration.
OTHERWISE acquire the global schema lock; inspect existing catalog and table owner before adding DDL.
DECLARE explicit types, primary/unique keys, World+realm composite foreign references and indexes.
SEPARATE migrator DDL from runtime roles; parameterize values and retain source/rights/retention lineage.
ORDER expand → backfill → validate → contract, with restartable bounded backfill.
TEST empty database, prior-schema upgrade, role denials, crash boundary and forward repair using real PostgreSQL.
ASSIGN final monotonic migration number only when the genuine SQL is reviewed; never pre-record a planned migration as applied.
```

## Owning state / operation contracts

### SPEC-043
OpenFederatedFrame(plan,localGrant,remoteDelegations) -> FederatedFrame; ProposeCoordination(plan) -> CoordinationCase; ObserveParticipant(receipt) -> PartialState; CompensateParticipant(action) -> NewLocalCase.

ontology.federation_links(link_id PK,local_world,remote_world,trust_profile,permitted_ops,rights_contract,expiry); ontology.federated_frames(frame_id PK,component_refs,cuts,rights_basis,skew,gaps); ontology.coordinations(coordination_id PK,world_id,plan_digest,participants,state,outcome); ontology.coordination_parts(coordination_id,participant PK,local_case_ref,receipt_ref,external_state). No shared global grant/token.

[algorithm SPEC-043](../../docs/algorithms/spec-043.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
