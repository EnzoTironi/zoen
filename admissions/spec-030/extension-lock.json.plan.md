# File plan — `admissions/spec-030/extension-lock.json`

**Status:** planned; no product acceptance implied.

Target: `admissions/spec-030/extension-lock.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-030](../../docs/specs/spec-030.md).
Tickets: [ZN-0174](../../docs/tickets/zn-0174.md), [ZN-0177](../../docs/tickets/zn-0177.md).

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

### SPEC-030
AcquireExecutionLease(installation,inputRefs,scope) -> Lease; BrokerRead(lease,resource) -> BoundedInput; BrokerCall(lease,capability,args) -> Observation; RunAnalysis(lease,artifact) -> AnalysisArtifact | Failed | Unknown.

ontology.execution_leases(lease_id PK,world_id,artifact_digest,principal,purpose,allowed_ops,input_refs,budget_ref,expires_at,epoch,state); jobs.runner_attempts(attempt_id PK,lease_id,host_profile,fence,state,output_ref,usage); ontology.analysis_artifacts(analysis_id PK,world_id,code_digest,input_cut,seed_nullable,determinism,output_ref,lineage,rights_label).

[algorithm SPEC-030](../../docs/algorithms/spec-030.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
