# SPEC-018 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-018](../specs/spec-018.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Security**. Module: `packages/ontology/src/rights`. Milestone: **S3**.

## Normative operation signatures

```text
Authorize(principal,operation,resource,purpose,destination,context) -> AllowBasis | Denied; DeriveRights(inputLabels,transform) -> OutputLabel | Rejected; OpenAudienceView(frame,audience) -> IntersectionView; Delegate(scope) -> DelegationReceipt.
```

## State and transaction contract

ontology.delegations(delegation_id PK,world_id,grantor,grantee,scope,purpose,destination,assurance,expires_at,parent_ref,revoked_at); ontology.rights_labels(label_id PK,world_id,source_refs,policy_refs,license_refs); ontology.source_acls(binding_id,acl_revision,subject_ref PK,permissions,valid_until); ontology.disclosure_receipts(receipt_id PK,frame_ref,audience_digest,rights_cut,outcome). Secret role/policy metadata obeys disclosure too.

## Shared algorithm

```text
INPUT: verified principal/delegation, operation, resource set, purpose, destination, app/session and current source licenses.
RESOLVE current membership, security revision, revocations, expiry and assurance; explicit deny takes precedence.
INTERSECT app/workload requested scope with admitted scope and caller rights; publisher privileges never transfer implicitly.
CONSTRUCT authorized ID/field/evidence set before ranking/counting/query execution using the supported policy profile.
IF safe bounded restriction cannot be produced, reject plan rather than compile arbitrary policy to permissive SQL.
DERIVE output labels from contributing sources and transformation rules; hidden rivals cannot influence unauthorized views.
RECHECK before replay/result/chunk/resumption; source ACL staleness blocks the affected disclosure.
RECORD permitted disclosure metadata, never hidden data or the existence of denied resources in public errors.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0106](../tickets/zn-0106.md) | Implement actual Cedar authorization and bounded plan admission | [packages/ontology/src/rights/cedar-admission.ts](../../packages/ontology/src/rights/cedar-admission.ts) |
| [ZN-0107](../tickets/zn-0107.md) | Implement narrow delegation, assurance and caregiver access | [packages/ontology/src/rights/delegation.ts](../../packages/ontology/src/rights/delegation.ts) |
| [ZN-0108](../tickets/zn-0108.md) | Propagate rights through lineage and derived artifacts | [packages/ontology/src/rights/derived-rights.ts](../../packages/ontology/src/rights/derived-rights.ts) |
| [ZN-0109](../tickets/zn-0109.md) | Implement audience intersections and view-local interpretations | [packages/ontology/src/rights/audience-view.ts](../../packages/ontology/src/rights/audience-view.ts) |
| [ZN-0110](../tickets/zn-0110.md) | Expire source ACLs and suppress in-flight revoked output | [packages/ontology/src/rights/rights-freshness.ts](../../packages/ontology/src/rights/rights-freshness.ts) |
| [ZN-0111](../tickets/zn-0111.md) | Prove noninterference across every public surface | [tests/journey/spec-018/rights-noninterference.test.ts](../../tests/journey/spec-018/rights-noninterference.test.ts) |

## Required proof boundaries

Explicit forbids and emergency deny prevail. Evaluate current membership/delegation and inherited source/license rights. Restrict SQL to the supported admission profile; arbitrary Cedar-to-SQL compilation is forbidden. If authorization cannot be safely pushed down, use a bounded authorized ID set or reject the plan. Hidden rivals must not influence view-local wording/counts unless a released declassification policy permits it.

V4 refinement: The common executor intersects current subject/delegation rights, admitted app capabilities, session purpose/scope and current source rights. App creators do not lend their privileges. Equal-basis noninterference includes app discovery, assets, exports, cursors, errors, counts and streams.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
