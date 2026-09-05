# SPEC-030 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-030](../specs/spec-030.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Platform Security**. Module: `runners`. Milestone: **S6**.

## Normative operation signatures

```text
AcquireExecutionLease(installation,inputRefs,scope) -> Lease; BrokerRead(lease,resource) -> BoundedInput; BrokerCall(lease,capability,args) -> Observation; RunAnalysis(lease,artifact) -> AnalysisArtifact | Failed | Unknown.
```

## State and transaction contract

ontology.execution_leases(lease_id PK,world_id,artifact_digest,principal,purpose,allowed_ops,input_refs,budget_ref,expires_at,epoch,state); jobs.runner_attempts(attempt_id PK,lease_id,host_profile,fence,state,output_ref,usage); ontology.analysis_artifacts(analysis_id PK,world_id,code_digest,input_cut,seed_nullable,determinism,output_ref,lineage,rights_label).

## Shared algorithm

```text
ACQUIRE lease bound to World/realm/principal/purpose/artifact/input cut/budget/epoch and admitted host profile.
START outside authority process in actual qualified containment with default-deny network and no ambient credentials.
DENY host files, container socket, metadata endpoints and authority/source secrets; enforce limits outside guest process.
FOR an app request expose only released semantic calls through the common executor; no generic URL/SQL/provider proxy.
FOR separately admitted acquisition/effect lanes validate capability, destination, DNS/redirect chain, body and lease on every use.
SUPPLY immutable read inputs for analysis, record nondeterminism/seed/environment and output lineage.
VALIDATE bounded outputs and current rights before admission; publishing is a separate governed operation.
ON expiry/revocation/resource violation stop fenced execution, retain real unknown effects and cleanup only unpinned artifacts.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0174](../tickets/zn-0174.md) | Admit one hardened runner host profile | [runners/runner-profile.ts](../../runners/runner-profile.ts) |
| [ZN-0175](../tickets/zn-0175.md) | Implement narrow lease and capability brokers | [runners/capability-broker.ts](../../runners/capability-broker.ts) |
| [ZN-0176](../tickets/zn-0176.md) | Enforce SSRF, DNS rebinding and resource ceilings | [runners/runner-limits.ts](../../runners/runner-limits.ts) |
| [ZN-0177](../tickets/zn-0177.md) | Implement Python, R and SQL read-only analysis profiles | [runners/analysis-profiles.ts](../../runners/analysis-profiles.ts) |
| [ZN-0178](../tickets/zn-0178.md) | Validate outputs, revocation and cancellation | [runners/runner-output.ts](../../runners/runner-output.ts) |
| [ZN-0179](../tickets/zn-0179.md) | Prove isolation with hostile artifacts on actual infrastructure | [admissions/spec-030/runner-security-proof.json](../../admissions/spec-030/runner-security-proof.json.plan.md) |

## Required proof boundaries

Deny host filesystem, Docker socket, authority DB, instance metadata and ambient credentials. Validate DNS and every redirect via brokered egress; guest network has default deny. Enforce CPU, memory, time, output, file and request limits outside process. Brokers check lease/body/resource/epoch/revocation on each use. Outputs pass schema/lineage/rights validation before admission.

V4 refinement: Distinguish semantic app calls from source acquisition and provider-effect broker lanes. App-facing BrokerRead/BrokerCall resolves released semantic operations through SPEC-007 only; it cannot expose a URL, arbitrary SQL, raw database handle or provider credential. Trusted connectors and effect workers retain their separately admitted internal roles; apps cannot request those roles.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
