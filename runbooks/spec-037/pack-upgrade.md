# File plan — `runbooks/spec-037/pack-upgrade.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-037/pack-upgrade.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-037](../../docs/specs/spec-037.md).
Tickets: [ZN-0215](../../docs/tickets/zn-0215.md).

## Responsibility and reuse

## ZN-0215 operational/repair procedure

Scope: Upgrade, rebase and remove packs safely. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
Upgrade/removal is requested
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
VERIFY publisher artifact identities, dependency closure and local policy before installation.
SEPARATE reusable definitions from per-World source credentials, private instances and overlays.
COMPUTE semantic/permission/retention diff for upgrades; conflicts are explicit, not last-writer wins.
PREPARE migration and classify affected Cases/Watches/Mandates/apps/sessions under common release machinery.
APPROVE under current local rights; marketplace reputation cannot grant new powers.
ACTIVATE exact immutable binding, never external latest; compatible rename differs from meaning compatibility.
ON uninstall/recall stop new use and handle pins, historical explanation, open work and private caches explicitly.
REPORT unsupported distribution/license/provider scope rather than treating package presence as production qualification.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
The operation is blocked pending disposition and cannot silently break the app or reuse stale approval
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-037
ResolvePackGraph(request,pinnedBase) -> LockedGraph; InstallPack(graph,overlay) -> Change; UpgradePack(install,target) -> SemanticDiff; RemovePack(install) -> DispositionPlan; VerifyPublisher(signature) -> VerifiedOrigin | Denied.

ontology.pack_versions(pack_digest PK,publisher,namespace,version,dependencies,requested_capabilities,artifact_refs,signature_ref,license_ref); ontology.pack_installs(install_id PK,world_id,pack_digest,overlay_ref,granted_scope,state); ontology.publisher_records(publisher_id PK,verified_identity,signing_keys,review_state); ontology.marketplace_entitlements(entitlement_id PK,world_id,pack_ref,terms_version,state). No publisher can query installed customer data by default.

[algorithm SPEC-037](../../docs/algorithms/spec-037.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
