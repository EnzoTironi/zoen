# SPEC-054 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-054](../specs/spec-054.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Runtime Platform**. Module: `packages/adapters/src/app-runtime/rivet`. Milestone: **S6**.

## Normative operation signatures

```text
Zoen-owned port: PrepareRuntime(artifact,profile,realm) -> PreparedRuntime; ProbeRuntime(preparation) -> Attestation; ResolvePreparedRuntime(binding,session) -> IsolatedTarget; RetireRuntime(slot) -> Result. These are Zoen adapter contracts, not asserted Rivet API names.
```

## State and transaction contract

jobs.app_runtime_preparations(preparation_id PK,world_id,realm,manifest_digest,artifact_digest,profile_digest,runtime_slot_ref,host_state_partition,attempt_fence,status,attestation_ref,expires_at); jobs.app_runtime_slots(slot_ref PK,immutable_identity,digest,runner_scope,state). Public AppPublicationBinding remains in the released Ontology graph. Runtime process globals/SQLite are not authoritative company data.

## Shared algorithm

```text
QUALIFY actual current Core API using real disposable instances and a genuine extension lock; do not invent SDK methods.
BUILD approved artifact in isolated build plane from trusted host policy with no live credentials.
PREPARE immutable internal slot bound to artifact/profile/realm/state partition; internal deploy success is not public publication.
PROBE actual behavior/recovery and record nonpublic attestation; reject overwrite or unsupported inactive-deploy assumptions.
JOIN attestation to ordinary release proof/preparation; only current-policy World activation changes the public binding.
RESOLVE every session through the admitted exact binding, never vendor latest or private preview bypass.
EXECUTE outside authority process with qualified containment and request-bound semantic capability; no provider/database secret.
ON loss/recall/split cache return unavailable or safe recreate for exact digest; never substitute a different app version.
RETIRE only after active publication/session/evaluation/retention pins allow it; failed qualification disables this adapter, not declarative apps.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0314](../tickets/zn-0314.md) | Qualify the exact Rivet Core API and compatibility boundary | [packages/adapters/src/app-runtime/rivet/rivet-api-probe.ts](../../packages/adapters/src/app-runtime/rivet/rivet-api-probe.ts) |
| [ZN-0315](../tickets/zn-0315.md) | Implement immutable candidate slots and public binding separation | [packages/adapters/src/app-runtime/rivet/rivet-preparation.ts](../../packages/adapters/src/app-runtime/rivet/rivet-preparation.ts) |
| [ZN-0316](../tickets/zn-0316.md) | Integrate staged app runtime with current-policy publication | [packages/adapters/src/app-runtime/rivet/rivet-binding.ts](../../packages/adapters/src/app-runtime/rivet/rivet-binding.ts) |
| [ZN-0317](../tickets/zn-0317.md) | Harden Rivet host configuration, build plane and credentials | [packages/adapters/src/app-runtime/rivet/rivet-host-profile.ts](../../packages/adapters/src/app-runtime/rivet/rivet-host-profile.ts) |
| [ZN-0318](../tickets/zn-0318.md) | Implement runtime recovery, recall and orphan retention | [packages/adapters/src/app-runtime/rivet/rivet-recovery.ts](../../packages/adapters/src/app-runtime/rivet/rivet-recovery.ts) |
| [ZN-0319](../tickets/zn-0319.md) | Admit the Rivet specialized runtime profile or record rejection | [admissions/spec-054/rivet-admission.json](../../admissions/spec-054/rivet-admission.json.plan.md) |

## Required proof boundaries

Read the dated primary-source ledger and recheck the actual APIs before pinning. Build in an isolated build plane with a locked dependency graph and no live credentials. Internal successful deploy is not public authorization. Map candidate/version IDs immutably; the edge resolves only an approved Zoen binding. No runtime latest alias, public preview bypass, automatic namespace with production secrets or automatic generated permission config.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
