# File plan — `tests/fixtures/spec-018/rights-freshness.json`

**Status:** planned; no product acceptance implied.

Target: `tests/fixtures/spec-018/rights-freshness.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-018](../../../docs/specs/spec-018.md).
Tickets: [ZN-0110](../../../docs/tickets/zn-0110.md).

## Responsibility and reuse

```text
CONDITIONAL INPUT FIXTURE PLAN — not an observed service result.
USE synthetic records within owned disposable namespaces and explicit valid/knowledge time.
INCLUDE comparable rivals, a denied source, duplicate provenance family and stale dependency when in scope.
COMPUTE fixed expected values from the owning oracle, not from the implementation under test.
LOAD through the real component/journey boundary; do not replace provider/database behavior with this file.
VERSION seed, units, rights and cleanup scope.
```

## Owning state / operation contracts

### SPEC-018
Authorize(principal,operation,resource,purpose,destination,context) -> AllowBasis | Denied; DeriveRights(inputLabels,transform) -> OutputLabel | Rejected; OpenAudienceView(frame,audience) -> IntersectionView; Delegate(scope) -> DelegationReceipt.

ontology.delegations(delegation_id PK,world_id,grantor,grantee,scope,purpose,destination,assurance,expires_at,parent_ref,revoked_at); ontology.rights_labels(label_id PK,world_id,source_refs,policy_refs,license_refs); ontology.source_acls(binding_id,acl_revision,subject_ref PK,permissions,valid_until); ontology.disclosure_receipts(receipt_id PK,frame_ref,audience_digest,rights_cut,outcome). Secret role/policy metadata obeys disclosure too.

[algorithm SPEC-018](../../../docs/algorithms/spec-018.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
