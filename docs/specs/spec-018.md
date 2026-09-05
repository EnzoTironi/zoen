# SPEC-018 — Fine-grained rights, delegation and audience-safe disclosure

**Milestone:** S3 · **Owner:** Security · **Root:** `packages/ontology/src/rights`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Permissions constrain discovery, planning, ranking, explanation and output, not only the final text. Derived artifacts inherit source restrictions. A merged identity or shared channel never broadens authority. Policy evaluation uses the actual admitted Cedar engine and an explicit bounded query-admission profile.

## Owned state and storage contract
ontology.delegations(delegation_id PK,world_id,grantor,grantee,scope,purpose,destination,assurance,expires_at,parent_ref,revoked_at); ontology.rights_labels(label_id PK,world_id,source_refs,policy_refs,license_refs); ontology.source_acls(binding_id,acl_revision,subject_ref PK,permissions,valid_until); ontology.disclosure_receipts(receipt_id PK,frame_ref,audience_digest,rights_cut,outcome). Secret role/policy metadata obeys disclosure too.

## Operations

```text
Authorize(principal,operation,resource,purpose,destination,context) -> AllowBasis | Denied; DeriveRights(inputLabels,transform) -> OutputLabel | Rejected; OpenAudienceView(frame,audience) -> IntersectionView; Delegate(scope) -> DelegationReceipt.
```

## Execution protocol
Explicit forbids and emergency deny prevail. Evaluate current membership/delegation and inherited source/license rights. Restrict SQL to the supported admission profile; arbitrary Cedar-to-SQL compilation is forbidden. If authorization cannot be safely pushed down, use a bounded authorized ID set or reject the plan. Hidden rivals must not influence view-local wording/counts unless a released declassification policy permits it.

V4 refinement: The common executor intersects current subject/delegation rights, admitted app capabilities, session purpose/scope and current source rights. App creators do not lend their privileges. Equal-basis noninterference includes app discovery, assets, exports, cursors, errors, counts and streams.

V4 normative detail: [single semantic path](../architecture/semantic-path.md).

## Pseudocode and file ownership

[algorithm SPEC-018](../algorithms/spec-018.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0106](../tickets/zn-0106.md) | Implement actual Cedar authorization and bounded plan admission | component | [ZN-0018](../tickets/zn-0018.md), [ZN-0046](../tickets/zn-0046.md), [ZN-0094](../tickets/zn-0094.md), [ZN-0105](../tickets/zn-0105.md) |
| [ZN-0107](../tickets/zn-0107.md) | Implement narrow delegation, assurance and caregiver access | component | [ZN-0106](../tickets/zn-0106.md) |
| [ZN-0108](../tickets/zn-0108.md) | Propagate rights through lineage and derived artifacts | component | [ZN-0107](../tickets/zn-0107.md) |
| [ZN-0109](../tickets/zn-0109.md) | Implement audience intersections and view-local interpretations | component | [ZN-0108](../tickets/zn-0108.md) |
| [ZN-0110](../tickets/zn-0110.md) | Expire source ACLs and suppress in-flight revoked output | component | [ZN-0109](../tickets/zn-0109.md) |
| [ZN-0111](../tickets/zn-0111.md) | Prove noninterference across every public surface | journey | [ZN-0110](../tickets/zn-0110.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `rights-and-access-control.md`, `models-retrieval-and-agents.md`. Read a named historical reference only when needed; it cannot override current contracts.
