# File plan — `runbooks/spec-034/compute-qualification.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-034/compute-qualification.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-034](../../docs/specs/spec-034.md).
Tickets: [ZN-0201](../../docs/tickets/zn-0201.md).

## Responsibility and reuse

## ZN-0201 operational/repair procedure

Scope: Qualify the selected external compute profile. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
A distributed/GPU capability is marked operational
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
AUTHORIZE virtual-source/query or compute request under released definitions and current license/purpose.
PLAN bounded remote work and reserve cost/egress before dispatch; select only admitted actual profile.
PIN source/query/version/cut guarantees supported by provider; lack of snapshot coherence remains explicit.
BROKER credentials and egress outside guests; no arbitrary remote SQL from an app.
RUN tasks under fenced identity and record actual environment, inputs, partitions and result digests.
VALIDATE output schema, completeness and lineage before making a published artifact.
RETURN partial/unknown when provider guarantees or partitions are missing; retries preserve original task identity.
PUBLISH through common authority/dataset interfaces, never install a parallel distributed truth store.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
The claim is rejected until the selected actual profile passes its evidence gate
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-034
ExecuteVirtualRead(plan,lease) -> CapturedResult | ReferenceOnlyResult; SubmitCompute(profile,artifact,inputs,budget) -> Run; ObserveCompute(run) -> State; AdmitComputeOutput(run) -> AnalysisOrDatasetProposal.

jobs.compute_runs(run_id PK,world_id,engine_profile,input_cut,artifact_digest,budget_ref,state,output_ref,usage); ontology.virtual_reads(read_id PK,world_id,source_binding,query_digest,external_snapshot_ref,observed_at,coverage,rights_ref,capture_ref_nullable). Engine configuration and scale parameters are versioned runtime data under an admitted adapter ABI.

[algorithm SPEC-034](../../docs/algorithms/spec-034.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
