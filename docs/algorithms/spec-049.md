# SPEC-049 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-049](../specs/spec-049.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Operations**. Module: `infra/terraform/pilot`. Milestone: **S1**.

## Normative operation signatures

```text
ProvisionPilot(lock,region,profile) -> StagedPilot; EnableCapability(capability,codeEvidence,providerEvidence,approval) -> Admission | Blocked; RollbackPilot(image,compatibleSchema) -> SafeDeployment.
```

## State and transaction contract

Infrastructure defines private PostgreSQL, encrypted evidence, separate edge/Eve/authority roles, hosted web, secret references, monitoring and backups under an admitted regional profile. control.capability_admissions(capability_id,profile PK,code_commit,qualification_refs,state) lists enabled versus disabled routes. No customer data in control records.

## Shared algorithm

```text
PROVISION the actual admitted shared profile with separate edge/Eve/authority identities and private storage.
SERVE only qualified core/web/file capabilities initially; channel/model/effect/runtime gates are independent.
KEEP identity, authority, evidence, erasure and idempotency identical to larger cells.
ADMIT owner-only continuation and declarative apps without requiring Rivet/dense/enterprise features.
MEASURE backup/recovery/capacity against the limited profile; no Fortune-500 availability claim from pilot size.
ENABLE each capability using commit-bound code/provider evidence plus current approval.
ROLL out signed image and compatible schema with health checks and explicit stop/repair path.
KEEP executable apps and all sensitive unqualified routes disabled until their exact host/runner tests pass.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0287](../tickets/zn-0287.md) | Provision the minimal shared regional hosted topology | [infra/terraform/pilot/pilot-topology.tf](../../infra/terraform/pilot/pilot-topology.tf.plan.md) |
| [ZN-0288](../tickets/zn-0288.md) | Implement capability-specific deployment admission flags | [infra/terraform/pilot/capability-admission.tf](../../infra/terraform/pilot/capability-admission.tf.plan.md) |
| [ZN-0289](../tickets/zn-0289.md) | Implement safe image/schema rollout and rollback | [infra/terraform/pilot/pilot-rollout.tf](../../infra/terraform/pilot/pilot-rollout.tf.plan.md) |
| [ZN-0290](../tickets/zn-0290.md) | Run real-data pilot readiness and privacy drills | [admissions/spec-049/pilot-readiness.json](../../admissions/spec-049/pilot-readiness.json.plan.md) |

## Required proof boundaries

The pilot has the same authority/rights/idempotency laws, smaller measured capacity and explicitly limited durability profile. Provider/channel/model admissions are independent; unqualified routes remain disabled while file/web core works. Backups, erasure suppression and incident stop are required before real sensitive data. Upgrade through the same immutable image/schema compatibility evidence.

V4 refinement: Private owner-only continuation and data-defined apps can be admitted without Rivet, dense storage or institutional SSO. User-supplied executable code remains off until its exact isolation and host gates pass.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
