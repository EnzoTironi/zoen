# File plan — `admissions/spec-054/extension-lock.json`

**Status:** planned; no product acceptance implied.

Target: `admissions/spec-054/extension-lock.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-054](../../docs/specs/spec-054.md).
Tickets: [ZN-0314](../../docs/tickets/zn-0314.md), [ZN-0316](../../docs/tickets/zn-0316.md).

## Responsibility and reuse

```text
EVIDENCE-REQUIRES-EXECUTION — deliberately no fabricated target artifact.
RUN the actual registry/package-manager/provider/infrastructure qualification for this ticket.
RECORD observed identities, exact versions/integrity, supported API/profile, commands and failed or blocked results.
REQUIRE independent approval and current expiry/scope where applicable.
ONLY produce a lock using the real package manager; only produce a certificate from actual evidence.
NEVER rename this plan into a passing report.
```

## Owning state / operation contracts

### SPEC-054
Zoen-owned port: PrepareRuntime(artifact,profile,realm) -> PreparedRuntime; ProbeRuntime(preparation) -> Attestation; ResolvePreparedRuntime(binding,session) -> IsolatedTarget; RetireRuntime(slot) -> Result. These are Zoen adapter contracts, not asserted Rivet API names.

jobs.app_runtime_preparations(preparation_id PK,world_id,realm,manifest_digest,artifact_digest,profile_digest,runtime_slot_ref,host_state_partition,attempt_fence,status,attestation_ref,expires_at); jobs.app_runtime_slots(slot_ref PK,immutable_identity,digest,runner_scope,state). Public AppPublicationBinding remains in the released Ontology graph. Runtime process globals/SQLite are not authoritative company data.

[algorithm SPEC-054](../../docs/algorithms/spec-054.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
