# SPEC-034 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-034](../specs/spec-034.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Data Platform**. Module: `packages/ontology/src/compute`. Milestone: **S7**.

## Normative operation signatures

```text
ExecuteVirtualRead(plan,lease) -> CapturedResult | ReferenceOnlyResult; SubmitCompute(profile,artifact,inputs,budget) -> Run; ObserveCompute(run) -> State; AdmitComputeOutput(run) -> AnalysisOrDatasetProposal.
```

## State and transaction contract

jobs.compute_runs(run_id PK,world_id,engine_profile,input_cut,artifact_digest,budget_ref,state,output_ref,usage); ontology.virtual_reads(read_id PK,world_id,source_binding,query_digest,external_snapshot_ref,observed_at,coverage,rights_ref,capture_ref_nullable). Engine configuration and scale parameters are versioned runtime data under an admitted adapter ABI.

## Shared algorithm

```text
AUTHORIZE virtual-source/query or compute request under released definitions and current license/purpose.
PLAN bounded remote work and reserve cost/egress before dispatch; select only admitted actual profile.
PIN source/query/version/cut guarantees supported by provider; lack of snapshot coherence remains explicit.
BROKER credentials and egress outside guests; no arbitrary remote SQL from an app.
RUN tasks under fenced identity and record actual environment, inputs, partitions and result digests.
VALIDATE output schema, completeness and lineage before making a published artifact.
RETURN partial/unknown when provider guarantees or partitions are missing; retries preserve original task identity.
PUBLISH through common authority/dataset interfaces, never install a parallel distributed truth store.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0197](../tickets/zn-0197.md) | Define virtual-source consistency and capture contracts | [packages/ontology/src/compute/virtual-source.ts](../../packages/ontology/src/compute/virtual-source.ts) |
| [ZN-0198](../tickets/zn-0198.md) | Implement governed remote query execution | [packages/ontology/src/compute/remote-query.ts](../../packages/ontology/src/compute/remote-query.ts) |
| [ZN-0199](../tickets/zn-0199.md) | Define distributed and GPU execution lifecycle | [packages/ontology/src/compute/distributed-contract.ts](../../packages/ontology/src/compute/distributed-contract.ts) |
| [ZN-0200](../tickets/zn-0200.md) | Validate reproducibility, costs and outputs | [packages/ontology/src/compute/compute-output.ts](../../packages/ontology/src/compute/compute-output.ts) |
| [ZN-0201](../tickets/zn-0201.md) | Qualify the selected external compute profile | [admissions/spec-034/compute-qualification.json](../../admissions/spec-034/compute-qualification.json.plan.md) |

## Required proof boundaries

Use a declared remote snapshot/transaction ID when the source supports it. Otherwise label reference-only/observed-time semantics and block actions requiring immutable retained basis. Distributed engines receive only scoped storage/compute leases and cannot publish directly. GPU nondeterminism is declared; exact output is retained while lawful, with reproducibility limits.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
