# File plan — `runbooks/spec-049/pilot-readiness.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-049/pilot-readiness.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-049](../../docs/specs/spec-049.md).
Tickets: [ZN-0290](../../docs/tickets/zn-0290.md).

## Responsibility and reuse

## ZN-0290 operational/repair procedure

Scope: Run real-data pilot readiness and privacy drills. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
Pilot activation is requested
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
PROVISION the actual admitted shared profile with separate edge/Eve/authority identities and private storage.
SERVE only qualified core/web/file capabilities initially; channel/model/effect/runtime gates are independent.
KEEP identity, authority, evidence, erasure and idempotency identical to larger cells.
ADMIT owner-only continuation and declarative apps without requiring Rivet/dense/enterprise features.
MEASURE backup/recovery/capacity against the limited profile; no Fortune-500 availability claim from pilot size.
ENABLE each capability using commit-bound code/provider evidence plus current approval.
ROLL out signed image and compatible schema with health checks and explicit stop/repair path.
KEEP executable apps and all sensitive unqualified routes disabled until their exact host/runner tests pass.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
Activation remains blocked until the operating prerequisites pass; early launch does not waive core trust laws
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-049
ProvisionPilot(lock,region,profile) -> StagedPilot; EnableCapability(capability,codeEvidence,providerEvidence,approval) -> Admission | Blocked; RollbackPilot(image,compatibleSchema) -> SafeDeployment.

Infrastructure defines private PostgreSQL, encrypted evidence, separate edge/Eve/authority roles, hosted web, secret references, monitoring and backups under an admitted regional profile. control.capability_admissions(capability_id,profile PK,code_commit,qualification_refs,state) lists enabled versus disabled routes. No customer data in control records.

[algorithm SPEC-049](../../docs/algorithms/spec-049.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
