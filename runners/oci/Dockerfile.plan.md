# File plan — `runners/oci/Dockerfile`

**Status:** planned; no product acceptance implied.

Target: `runners/oci/Dockerfile`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-030](../../docs/specs/spec-030.md), [SPEC-054](../../docs/specs/spec-054.md).
Tickets: [ZN-0174](../../docs/tickets/zn-0174.md), [ZN-0175](../../docs/tickets/zn-0175.md), [ZN-0176](../../docs/tickets/zn-0176.md), [ZN-0177](../../docs/tickets/zn-0177.md), [ZN-0178](../../docs/tickets/zn-0178.md), [ZN-0317](../../docs/tickets/zn-0317.md).

## Responsibility and reuse

```text
EXECUTION CONFIGURATION PLAN — not an active deployment/CI configuration.
WAIT for the actual dependency/profile admission; use genuine immutable images/actions/packages and secret references.
WIRE only already-declared processes/ports and least-privilege identities.
KEEP real provider routes disabled until qualified; no placeholder jobs returning success.
TEST plan validation and actual admitted deployment separately; no invented hashes/account IDs/certificates.
```

## Owning state / operation contracts

### SPEC-030
AcquireExecutionLease(installation,inputRefs,scope) -> Lease; BrokerRead(lease,resource) -> BoundedInput; BrokerCall(lease,capability,args) -> Observation; RunAnalysis(lease,artifact) -> AnalysisArtifact | Failed | Unknown.

ontology.execution_leases(lease_id PK,world_id,artifact_digest,principal,purpose,allowed_ops,input_refs,budget_ref,expires_at,epoch,state); jobs.runner_attempts(attempt_id PK,lease_id,host_profile,fence,state,output_ref,usage); ontology.analysis_artifacts(analysis_id PK,world_id,code_digest,input_cut,seed_nullable,determinism,output_ref,lineage,rights_label).

[algorithm SPEC-030](../../docs/algorithms/spec-030.md)

### SPEC-054
Zoen-owned port: PrepareRuntime(artifact,profile,realm) -> PreparedRuntime; ProbeRuntime(preparation) -> Attestation; ResolvePreparedRuntime(binding,session) -> IsolatedTarget; RetireRuntime(slot) -> Result. These are Zoen adapter contracts, not asserted Rivet API names.

jobs.app_runtime_preparations(preparation_id PK,world_id,realm,manifest_digest,artifact_digest,profile_digest,runtime_slot_ref,host_state_partition,attempt_fence,status,attestation_ref,expires_at); jobs.app_runtime_slots(slot_ref PK,immutable_identity,digest,runner_scope,state). Public AppPublicationBinding remains in the released Ontology graph. Runtime process globals/SQLite are not authoritative company data.

[algorithm SPEC-054](../../docs/algorithms/spec-054.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
