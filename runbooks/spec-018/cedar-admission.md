# File plan — `runbooks/spec-018/cedar-admission.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-018/cedar-admission.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-018](../../docs/specs/spec-018.md).
Tickets: [ZN-0106](../../docs/tickets/zn-0106.md).

## Responsibility and reuse

## ZN-0106 operational/repair procedure

Scope: Implement actual Cedar authorization and bounded plan admission. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
Authorization and planning run
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
INPUT: verified principal/delegation, operation, resource set, purpose, destination, app/session and current source licenses.
RESOLVE current membership, security revision, revocations, expiry and assurance; explicit deny takes precedence.
INTERSECT app/workload requested scope with admitted scope and caller rights; publisher privileges never transfer implicitly.
CONSTRUCT authorized ID/field/evidence set before ranking/counting/query execution using the supported policy profile.
IF safe bounded restriction cannot be produced, reject plan rather than compile arbitrary policy to permissive SQL.
DERIVE output labels from contributing sources and transformation rules; hidden rivals cannot influence unauthorized views.
RECHECK before replay/result/chunk/resumption; source ACL staleness blocks the affected disclosure.
RECORD permitted disclosure metadata, never hidden data or the existence of denied resources in public errors.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
The forbid denies the operation; unsupported planning returns UnsupportedPlan instead of fetching everything for later filtering
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-018
Authorize(principal,operation,resource,purpose,destination,context) -> AllowBasis | Denied; DeriveRights(inputLabels,transform) -> OutputLabel | Rejected; OpenAudienceView(frame,audience) -> IntersectionView; Delegate(scope) -> DelegationReceipt.

ontology.delegations(delegation_id PK,world_id,grantor,grantee,scope,purpose,destination,assurance,expires_at,parent_ref,revoked_at); ontology.rights_labels(label_id PK,world_id,source_refs,policy_refs,license_refs); ontology.source_acls(binding_id,acl_revision,subject_ref PK,permissions,valid_until); ontology.disclosure_receipts(receipt_id PK,frame_ref,audience_digest,rights_cut,outcome). Secret role/policy metadata obeys disclosure too.

[algorithm SPEC-018](../../docs/algorithms/spec-018.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
