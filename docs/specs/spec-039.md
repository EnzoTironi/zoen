# SPEC-039 — Dedicated regional cells, private networking and recovery

**Milestone:** S9 · **Owner:** Operations Security · **Root:** `infra/terraform/aws`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Use the selected AWS regional-cell profile with service/version/extension availability verified at provisioning. Dedicated cells add measured isolation and recovery, not a marketing flag. Durable Restate/catalog state never relies on ephemeral worker storage.

## Owned state and storage contract
Infrastructure state describes account/region/cell, authority database, object namespaces, KMS keys, private endpoints, workload identities, backup policy and admitted image digests. control.cells(cell_id PK,region,profile,epoch,admission_ref,state); audit.recovery_runs(run_id PK,cell_id,backup_ref,measured_rpo,measured_rto,evidence_ref). Customer content stays out of the directory/control plane.

## Operations

```text
ProvisionCell(profile,region,lock) -> StagedCell; AdmitCell(evidence) -> ActiveCell; RestoreCell(backup,ledger,profile) -> ReadOnlyCell; OpenPrivateConnector(profile) -> ScopedRoute.
```

## Execution protocol
Separate trusted edge/Eve/authority/effects/runner identities and networks. RDS HA/PITR, S3/KMS controls and native service availability are admitted per region. Restore effects disabled and reconcile deletion/escaped effects before write admission. Dedicated keys/account boundaries are policy-selected and tested. Self-hosted equivalence belongs to S10, not an untested Terraform claim.

## Pseudocode and file ownership

[algorithm SPEC-039](../algorithms/spec-039.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0225](../tickets/zn-0225.md) | Provision dedicated cell network and identity boundaries | component | [ZN-0185](../tickets/zn-0185.md), [ZN-0223](../tickets/zn-0223.md), [ZN-0289](../tickets/zn-0289.md) |
| [ZN-0226](../tickets/zn-0226.md) | Configure authority, evidence and catalog durability | component | [ZN-0225](../tickets/zn-0225.md) |
| [ZN-0227](../tickets/zn-0227.md) | Admit durable Restate deployment and effect recovery | component | [ZN-0226](../tickets/zn-0226.md) |
| [ZN-0228](../tickets/zn-0228.md) | Implement residency, keys and private connectivity controls | component | [ZN-0227](../tickets/zn-0227.md) |
| [ZN-0229](../tickets/zn-0229.md) | Run recovery drills with measured RPO/RTO | chaos | [ZN-0228](../tickets/zn-0228.md) |
| [ZN-0230](../tickets/zn-0230.md) | Admit the enterprise hosted profile | admission | [ZN-0229](../tickets/zn-0229.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `deployment-cells-and-federation.md`, `security-and-operations.md`, `technology-stack.md`. Read a named historical reference only when needed; it cannot override current contracts.
