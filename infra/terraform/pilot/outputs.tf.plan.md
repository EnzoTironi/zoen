# File plan — `infra/terraform/pilot/outputs.tf`

**Status:** planned; no product acceptance implied.

Target: `infra/terraform/pilot/outputs.tf`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-049](../../../docs/specs/spec-049.md).
Tickets: [ZN-0287](../../../docs/tickets/zn-0287.md), [ZN-0288](../../../docs/tickets/zn-0288.md), [ZN-0289](../../../docs/tickets/zn-0289.md).

## Responsibility and reuse

```text
EXECUTION CONFIGURATION PLAN — not an active deployment/CI configuration.
WAIT for the actual dependency/profile admission; use genuine immutable images/actions/packages and secret references.
WIRE only already-declared processes/ports and least-privilege identities.
KEEP real provider routes disabled until qualified; no placeholder jobs returning success.
TEST plan validation and actual admitted deployment separately; no invented hashes/account IDs/certificates.
```

## Owning state / operation contracts

### SPEC-049
ProvisionPilot(lock,region,profile) -> StagedPilot; EnableCapability(capability,codeEvidence,providerEvidence,approval) -> Admission | Blocked; RollbackPilot(image,compatibleSchema) -> SafeDeployment.

Infrastructure defines private PostgreSQL, encrypted evidence, separate edge/Eve/authority roles, hosted web, secret references, monitoring and backups under an admitted regional profile. control.capability_admissions(capability_id,profile PK,code_commit,qualification_refs,state) lists enabled versus disabled routes. No customer data in control records.

[algorithm SPEC-049](../../../docs/algorithms/spec-049.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
