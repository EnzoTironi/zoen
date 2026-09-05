# SPEC-054 — Rivet Dynamic Apps Core qualification and immutable runtime adapter

**Milestone:** S6 · **Owner:** Runtime Platform · **Root:** `packages/adapters/src/app-runtime/rivet`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Rivet Dynamic Apps Core is the first candidate specialized backend adapter, not the required substrate of declarative apps or an authority service. Current upstream Preview/API behavior must be qualified at an exact lock. Candidate deployment and Zoen publication must stay separate even if deployApp activates its internal appId.

## Owned state and storage contract
jobs.app_runtime_preparations(preparation_id PK,world_id,realm,manifest_digest,artifact_digest,profile_digest,runtime_slot_ref,host_state_partition,attempt_fence,status,attestation_ref,expires_at); jobs.app_runtime_slots(slot_ref PK,immutable_identity,digest,runner_scope,state). Public AppPublicationBinding remains in the released Ontology graph. Runtime process globals/SQLite are not authoritative company data.

## Operations

```text
Zoen-owned port: PrepareRuntime(artifact,profile,realm) -> PreparedRuntime; ProbeRuntime(preparation) -> Attestation; ResolvePreparedRuntime(binding,session) -> IsolatedTarget; RetireRuntime(slot) -> Result. These are Zoen adapter contracts, not asserted Rivet API names.
```

## Execution protocol
Read the dated primary-source ledger and recheck the actual APIs before pinning. Build in an isolated build plane with a locked dependency graph and no live credentials. Internal successful deploy is not public authorization. Map candidate/version IDs immutably; the edge resolves only an approved Zoen binding. No runtime latest alias, public preview bypass, automatic namespace with production secrets or automatic generated permission config.

Primary sources and uncertainty: [Rivet adapter contract](../architecture/rivet-adapter.md) and [source ledger](../lineage/source-ledger.md). This pack does not claim any Rivet probe was run.

## Pseudocode and file ownership

[algorithm SPEC-054](../algorithms/spec-054.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0314](../tickets/zn-0314.md) | Qualify the exact Rivet Core API and compatibility boundary | component | [ZN-0170](../tickets/zn-0170.md), [ZN-0174](../tickets/zn-0174.md) |
| [ZN-0315](../tickets/zn-0315.md) | Implement immutable candidate slots and public binding separation | component | [ZN-0304](../tickets/zn-0304.md), [ZN-0310](../tickets/zn-0310.md), [ZN-0314](../tickets/zn-0314.md) |
| [ZN-0316](../tickets/zn-0316.md) | Integrate staged app runtime with current-policy publication | component | [ZN-0086](../tickets/zn-0086.md), [ZN-0172](../tickets/zn-0172.md), [ZN-0315](../tickets/zn-0315.md) |
| [ZN-0317](../tickets/zn-0317.md) | Harden Rivet host configuration, build plane and credentials | component | [ZN-0176](../tickets/zn-0176.md), [ZN-0311](../tickets/zn-0311.md), [ZN-0316](../tickets/zn-0316.md) |
| [ZN-0318](../tickets/zn-0318.md) | Implement runtime recovery, recall and orphan retention | component | [ZN-0312](../tickets/zn-0312.md), [ZN-0317](../tickets/zn-0317.md) |
| [ZN-0319](../tickets/zn-0319.md) | Admit the Rivet specialized runtime profile or record rejection | admission | [ZN-0179](../tickets/zn-0179.md), [ZN-0318](../tickets/zn-0318.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `apps-charts-and-surfaces.md`, `programmable-compute-and-skills.md`. Read a named historical reference only when needed; it cannot override current contracts.
