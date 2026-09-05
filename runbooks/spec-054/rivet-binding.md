# File plan — `runbooks/spec-054/rivet-binding.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-054/rivet-binding.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-054](../../docs/specs/spec-054.md).
Tickets: [ZN-0316](../../docs/tickets/zn-0316.md).

## Responsibility and reuse

## ZN-0316 operational/repair procedure

Scope: Integrate staged app runtime with current-policy publication. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
The author attempts to promote B
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
QUALIFY actual current Core API using real disposable instances and a genuine extension lock; do not invent SDK methods.
BUILD approved artifact in isolated build plane from trusted host policy with no live credentials.
PREPARE immutable internal slot bound to artifact/profile/realm/state partition; internal deploy success is not public publication.
PROBE actual behavior/recovery and record nonpublic attestation; reject overwrite or unsupported inactive-deploy assumptions.
JOIN attestation to ordinary release proof/preparation; only current-policy World activation changes the public binding.
RESOLVE every session through the admitted exact binding, never vendor latest or private preview bypass.
EXECUTE outside authority process with qualified containment and request-bound semantic capability; no provider/database secret.
ON loss/recall/split cache return unavailable or safe recreate for exact digest; never substitute a different app version.
RETIRE only after active publication/session/evaluation/retention pins allow it; failed qualification disables this adapter, not declarative apps.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
Activation is denied and A remains active; an unrelated Core deployment or warm VM refresh cannot override the Zoen binding
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-054
Zoen-owned port: PrepareRuntime(artifact,profile,realm) -> PreparedRuntime; ProbeRuntime(preparation) -> Attestation; ResolvePreparedRuntime(binding,session) -> IsolatedTarget; RetireRuntime(slot) -> Result. These are Zoen adapter contracts, not asserted Rivet API names.

jobs.app_runtime_preparations(preparation_id PK,world_id,realm,manifest_digest,artifact_digest,profile_digest,runtime_slot_ref,host_state_partition,attempt_fence,status,attestation_ref,expires_at); jobs.app_runtime_slots(slot_ref PK,immutable_identity,digest,runner_scope,state). Public AppPublicationBinding remains in the released Ontology graph. Runtime process globals/SQLite are not authoritative company data.

[algorithm SPEC-054](../../docs/algorithms/spec-054.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
