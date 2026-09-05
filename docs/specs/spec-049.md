# SPEC-049 — Shared hosted pilot and progressive product activation

**Milestone:** S1 · **Owner:** Operations · **Root:** `infra/terraform/pilot`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Consumers and prosumers must not wait for the institutional stack. Provision a minimal shared regional hosted profile for admitted early capabilities; install catalog/distributed/custom-code infrastructure only when its slice needs it. Pilot status is explicit and does not imply enterprise HA or full regulated execution.

## Owned state and storage contract
Infrastructure defines private PostgreSQL, encrypted evidence, separate edge/Eve/authority roles, hosted web, secret references, monitoring and backups under an admitted regional profile. control.capability_admissions(capability_id,profile PK,code_commit,qualification_refs,state) lists enabled versus disabled routes. No customer data in control records.

## Operations

```text
ProvisionPilot(lock,region,profile) -> StagedPilot; EnableCapability(capability,codeEvidence,providerEvidence,approval) -> Admission | Blocked; RollbackPilot(image,compatibleSchema) -> SafeDeployment.
```

## Execution protocol
The pilot has the same authority/rights/idempotency laws, smaller measured capacity and explicitly limited durability profile. Provider/channel/model admissions are independent; unqualified routes remain disabled while file/web core works. Backups, erasure suppression and incident stop are required before real sensitive data. Upgrade through the same immutable image/schema compatibility evidence.

V4 refinement: Private owner-only continuation and data-defined apps can be admitted without Rivet, dense storage or institutional SSO. User-supplied executable code remains off until its exact isolation and host gates pass.

The pilot is not dependent on S9 enterprise provisioning. Later capabilities are added through independent admission flags. Missing WhatsApp/provider admission does not prevent an otherwise qualified file/web pilot.

V4 normative detail: [single semantic path](../architecture/semantic-path.md).

## Pseudocode and file ownership

[algorithm SPEC-049](../algorithms/spec-049.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0287](../tickets/zn-0287.md) | Provision the minimal shared regional hosted topology | component | [ZN-0051](../tickets/zn-0051.md), [ZN-0073](../tickets/zn-0073.md) |
| [ZN-0288](../tickets/zn-0288.md) | Implement capability-specific deployment admission flags | component | [ZN-0287](../tickets/zn-0287.md) |
| [ZN-0289](../tickets/zn-0289.md) | Implement safe image/schema rollout and rollback | component | [ZN-0288](../tickets/zn-0288.md) |
| [ZN-0290](../tickets/zn-0290.md) | Run real-data pilot readiness and privacy drills | admission | [ZN-0289](../tickets/zn-0289.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `technology-stack.md`, `deployment-cells-and-federation.md`, `capacity-economics-and-slos.md`. Read a named historical reference only when needed; it cannot override current contracts.
