# SPEC-030 — Isolated runners, credential brokers and programmable analysis

**Milestone:** S6 · **Owner:** Platform Security · **Root:** `runners`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Trust isolation is enforced outside guest code. Use the admitted gVisor or microVM-grade profile on dedicated runner infrastructure, not a privileged Docker container. Python/R/SQL analyses are read-only over leased immutable inputs; publishing is a separate governed operation.

## Owned state and storage contract
ontology.execution_leases(lease_id PK,world_id,artifact_digest,principal,purpose,allowed_ops,input_refs,budget_ref,expires_at,epoch,state); jobs.runner_attempts(attempt_id PK,lease_id,host_profile,fence,state,output_ref,usage); ontology.analysis_artifacts(analysis_id PK,world_id,code_digest,input_cut,seed_nullable,determinism,output_ref,lineage,rights_label).

## Operations

```text
AcquireExecutionLease(installation,inputRefs,scope) -> Lease; BrokerRead(lease,resource) -> BoundedInput; BrokerCall(lease,capability,args) -> Observation; RunAnalysis(lease,artifact) -> AnalysisArtifact | Failed | Unknown.
```

## Execution protocol
Deny host filesystem, Docker socket, authority DB, instance metadata and ambient credentials. Validate DNS and every redirect via brokered egress; guest network has default deny. Enforce CPU, memory, time, output, file and request limits outside process. Brokers check lease/body/resource/epoch/revocation on each use. Outputs pass schema/lineage/rights validation before admission.

V4 refinement: Distinguish semantic app calls from source acquisition and provider-effect broker lanes. App-facing BrokerRead/BrokerCall resolves released semantic operations through SPEC-007 only; it cannot expose a URL, arbitrary SQL, raw database handle or provider credential. Trusted connectors and effect workers retain their separately admitted internal roles; apps cannot request those roles.

V4 normative detail: [single semantic path](../architecture/semantic-path.md).

## Pseudocode and file ownership

[algorithm SPEC-030](../algorithms/spec-030.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0174](../tickets/zn-0174.md) | Admit one hardened runner host profile | component | [ZN-0111](../tickets/zn-0111.md), [ZN-0139](../tickets/zn-0139.md), [ZN-0173](../tickets/zn-0173.md) |
| [ZN-0175](../tickets/zn-0175.md) | Implement narrow lease and capability brokers | component | [ZN-0174](../tickets/zn-0174.md) |
| [ZN-0176](../tickets/zn-0176.md) | Enforce SSRF, DNS rebinding and resource ceilings | component | [ZN-0175](../tickets/zn-0175.md) |
| [ZN-0177](../tickets/zn-0177.md) | Implement Python, R and SQL read-only analysis profiles | component | [ZN-0176](../tickets/zn-0176.md) |
| [ZN-0178](../tickets/zn-0178.md) | Validate outputs, revocation and cancellation | component | [ZN-0177](../tickets/zn-0177.md) |
| [ZN-0179](../tickets/zn-0179.md) | Prove isolation with hostile artifacts on actual infrastructure | admission | [ZN-0178](../tickets/zn-0178.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `programmable-compute-and-skills.md`, `security-and-operations.md`. Read a named historical reference only when needed; it cannot override current contracts.
