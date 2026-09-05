# SPEC-039 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-039](../specs/spec-039.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Operations Security**. Module: `infra/terraform/aws`. Milestone: **S9**.

## Normative operation signatures

```text
ProvisionCell(profile,region,lock) -> StagedCell; AdmitCell(evidence) -> ActiveCell; RestoreCell(backup,ledger,profile) -> ReadOnlyCell; OpenPrivateConnector(profile) -> ScopedRoute.
```

## State and transaction contract

Infrastructure state describes account/region/cell, authority database, object namespaces, KMS keys, private endpoints, workload identities, backup policy and admitted image digests. control.cells(cell_id PK,region,profile,epoch,admission_ref,state); audit.recovery_runs(run_id PK,cell_id,backup_ref,measured_rpo,measured_rto,evidence_ref). Customer content stays out of the directory/control plane.

## Shared algorithm

```text
SELECT reviewed regional profile, immutable infrastructure/dependency/image identities and secret references.
PROVISION actual separated edge/Eve/authority/effect/runner identities, databases, object namespaces and private network routes.
ENFORCE residency/keys/least privilege using native provider controls; record measured operating limits.
BACK UP with coherent manifests, deletion ledger and escaped-effect references; test on disposable real infrastructure.
RESTORE read-only with all dispatch disabled; reconcile current erasure suppression and provider ambiguity.
VERIFY rights, pins, role separation and current coordinator epoch before write admission.
REQUIRE operator/security evidence for that exact account/region/profile; Terraform existence is not an admitted cell.
ROLL back only compatible code or a proved forward schema/data repair; retain source tenant data until approved cutover.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0225](../tickets/zn-0225.md) | Provision dedicated cell network and identity boundaries | [infra/terraform/aws/dedicated-cell.tf](../../infra/terraform/aws/dedicated-cell.tf.plan.md) |
| [ZN-0226](../tickets/zn-0226.md) | Configure authority, evidence and catalog durability | [infra/terraform/aws/durable-storage.tf](../../infra/terraform/aws/durable-storage.tf.plan.md) |
| [ZN-0227](../tickets/zn-0227.md) | Admit durable Restate deployment and effect recovery | [infra/terraform/aws/restate-ha.tf](../../infra/terraform/aws/restate-ha.tf.plan.md) |
| [ZN-0228](../tickets/zn-0228.md) | Implement residency, keys and private connectivity controls | [infra/terraform/aws/residency.tf](../../infra/terraform/aws/residency.tf.plan.md) |
| [ZN-0229](../tickets/zn-0229.md) | Run recovery drills with measured RPO/RTO | [tests/chaos/spec-039/enterprise-recovery.test.ts](../../tests/chaos/spec-039/enterprise-recovery.test.ts) |
| [ZN-0230](../tickets/zn-0230.md) | Admit the enterprise hosted profile | [admissions/spec-039/enterprise-cloud-admission.json](../../admissions/spec-039/enterprise-cloud-admission.json.plan.md) |

## Required proof boundaries

Separate trusted edge/Eve/authority/effects/runner identities and networks. RDS HA/PITR, S3/KMS controls and native service availability are admitted per region. Restore effects disabled and reconcile deletion/escaped effects before write admission. Dedicated keys/account boundaries are policy-selected and tested. Self-hosted equivalence belongs to S10, not an untested Terraform claim.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
