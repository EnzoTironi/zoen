# File plan — `runbooks/spec-030/runner-output.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-030/runner-output.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-030](../../docs/specs/spec-030.md).
Tickets: [ZN-0178](../../docs/tickets/zn-0178.md).

## Responsibility and reuse

## ZN-0178 operational/repair procedure

Scope: Validate outputs, revocation and cancellation. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
It submits an output artifact
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
ACQUIRE lease bound to World/realm/principal/purpose/artifact/input cut/budget/epoch and admitted host profile.
START outside authority process in actual qualified containment with default-deny network and no ambient credentials.
DENY host files, container socket, metadata endpoints and authority/source secrets; enforce limits outside guest process.
FOR an app request expose only released semantic calls through the common executor; no generic URL/SQL/provider proxy.
FOR separately admitted acquisition/effect lanes validate capability, destination, DNS/redirect chain, body and lease on every use.
SUPPLY immutable read inputs for analysis, record nondeterminism/seed/environment and output lineage.
VALIDATE bounded outputs and current rights before admission; publishing is a separate governed operation.
ON expiry/revocation/resource violation stop fenced execution, retain real unknown effects and cleanup only unpinned artifacts.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
The output is rejected or retained as quarantined evidence under policy; it cannot publish into the live World
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-030
AcquireExecutionLease(installation,inputRefs,scope) -> Lease; BrokerRead(lease,resource) -> BoundedInput; BrokerCall(lease,capability,args) -> Observation; RunAnalysis(lease,artifact) -> AnalysisArtifact | Failed | Unknown.

ontology.execution_leases(lease_id PK,world_id,artifact_digest,principal,purpose,allowed_ops,input_refs,budget_ref,expires_at,epoch,state); jobs.runner_attempts(attempt_id PK,lease_id,host_profile,fence,state,output_ref,usage); ontology.analysis_artifacts(analysis_id PK,world_id,code_digest,input_cut,seed_nullable,determinism,output_ref,lineage,rights_label).

[algorithm SPEC-030](../../docs/algorithms/spec-030.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
