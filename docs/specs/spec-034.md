# SPEC-034 — Virtual sources and distributed/GPU compute adapters

**Milestone:** S7 · **Owner:** Data Platform · **Root:** `packages/ontology/src/compute`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Large/distributed/GPU work runs behind a governed job contract, not inside the authority service. Virtual sources declare their external consistency and retention limitations. An external current query is not automatically a replayable historical basis.

## Owned state and storage contract
jobs.compute_runs(run_id PK,world_id,engine_profile,input_cut,artifact_digest,budget_ref,state,output_ref,usage); ontology.virtual_reads(read_id PK,world_id,source_binding,query_digest,external_snapshot_ref,observed_at,coverage,rights_ref,capture_ref_nullable). Engine configuration and scale parameters are versioned runtime data under an admitted adapter ABI.

## Operations

```text
ExecuteVirtualRead(plan,lease) -> CapturedResult | ReferenceOnlyResult; SubmitCompute(profile,artifact,inputs,budget) -> Run; ObserveCompute(run) -> State; AdmitComputeOutput(run) -> AnalysisOrDatasetProposal.
```

## Execution protocol
Use a declared remote snapshot/transaction ID when the source supports it. Otherwise label reference-only/observed-time semantics and block actions requiring immutable retained basis. Distributed engines receive only scoped storage/compute leases and cannot publish directly. GPU nondeterminism is declared; exact output is retained while lawful, with reproducibility limits.

## Pseudocode and file ownership

[algorithm SPEC-034](../algorithms/spec-034.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0197](../tickets/zn-0197.md) | Define virtual-source consistency and capture contracts | component | [ZN-0178](../tickets/zn-0178.md), [ZN-0185](../tickets/zn-0185.md), [ZN-0191](../tickets/zn-0191.md) |
| [ZN-0198](../tickets/zn-0198.md) | Implement governed remote query execution | component | [ZN-0197](../tickets/zn-0197.md) |
| [ZN-0199](../tickets/zn-0199.md) | Define distributed and GPU execution lifecycle | component | [ZN-0198](../tickets/zn-0198.md) |
| [ZN-0200](../tickets/zn-0200.md) | Validate reproducibility, costs and outputs | component | [ZN-0199](../tickets/zn-0199.md) |
| [ZN-0201](../tickets/zn-0201.md) | Qualify the selected external compute profile | admission | [ZN-0200](../tickets/zn-0200.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `data-flows-and-live-data.md`, `programmable-compute-and-skills.md`. Read a named historical reference only when needed; it cannot override current contracts.
