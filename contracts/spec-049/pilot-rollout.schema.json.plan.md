# File plan — `contracts/spec-049/pilot-rollout.schema.json`

**Status:** planned; no product acceptance implied.

Target: `contracts/spec-049/pilot-rollout.schema.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-049](../../docs/specs/spec-049.md).
Tickets: [ZN-0289](../../docs/tickets/zn-0289.md).

## Responsibility and reuse

```text
CONDITIONAL SCHEMA PLAN — no permissive {} schema or fabricated generated types.
RESOLVE exact input/output/tagged-error fields from the operation signatures and common protocol.
REQUIRE bounded sizes/depth/arrays, exact discriminants, validated IDs and explicit optional/null distinctions.
REJECT additional or authority-bearing client fields; money/counters stay strings where required.
GENERATE canonical fixtures, wire types and surface descriptors from this single reviewed schema source.
TEST malformed/oversized/unknown-version inputs and exact round trips; registry presence alone is not a pass.
```

## Owning state / operation contracts

### SPEC-049
ProvisionPilot(lock,region,profile) -> StagedPilot; EnableCapability(capability,codeEvidence,providerEvidence,approval) -> Admission | Blocked; RollbackPilot(image,compatibleSchema) -> SafeDeployment.

Infrastructure defines private PostgreSQL, encrypted evidence, separate edge/Eve/authority roles, hosted web, secret references, monitoring and backups under an admitted regional profile. control.capability_admissions(capability_id,profile PK,code_commit,qualification_refs,state) lists enabled versus disabled routes. No customer data in control records.

[algorithm SPEC-049](../../docs/algorithms/spec-049.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
