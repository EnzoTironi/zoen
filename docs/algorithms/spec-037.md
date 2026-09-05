# SPEC-037 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-037](../specs/spec-037.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Developer Platform**. Module: `packages/ontology/src/packs`. Milestone: **S8**.

## Normative operation signatures

```text
ResolvePackGraph(request,pinnedBase) -> LockedGraph; InstallPack(graph,overlay) -> Change; UpgradePack(install,target) -> SemanticDiff; RemovePack(install) -> DispositionPlan; VerifyPublisher(signature) -> VerifiedOrigin | Denied.
```

## State and transaction contract

ontology.pack_versions(pack_digest PK,publisher,namespace,version,dependencies,requested_capabilities,artifact_refs,signature_ref,license_ref); ontology.pack_installs(install_id PK,world_id,pack_digest,overlay_ref,granted_scope,state); ontology.publisher_records(publisher_id PK,verified_identity,signing_keys,review_state); ontology.marketplace_entitlements(entitlement_id PK,world_id,pack_ref,terms_version,state). No publisher can query installed customer data by default.

## Shared algorithm

```text
VERIFY publisher artifact identities, dependency closure and local policy before installation.
SEPARATE reusable definitions from per-World source credentials, private instances and overlays.
COMPUTE semantic/permission/retention diff for upgrades; conflicts are explicit, not last-writer wins.
PREPARE migration and classify affected Cases/Watches/Mandates/apps/sessions under common release machinery.
APPROVE under current local rights; marketplace reputation cannot grant new powers.
ACTIVATE exact immutable binding, never external latest; compatible rename differs from meaning compatibility.
ON uninstall/recall stop new use and handle pins, historical explanation, open work and private caches explicitly.
REPORT unsupported distribution/license/provider scope rather than treating package presence as production qualification.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0213](../tickets/zn-0213.md) | Implement signed pack registry and dependency lock resolution | [packages/ontology/src/packs/pack-registry.ts](../../packages/ontology/src/packs/pack-registry.ts) |
| [ZN-0214](../tickets/zn-0214.md) | Implement local overlays and semantic dependency mapping | [packages/ontology/src/packs/pack-overlays.ts](../../packages/ontology/src/packs/pack-overlays.ts) |
| [ZN-0215](../tickets/zn-0215.md) | Upgrade, rebase and remove packs safely | [packages/ontology/src/packs/pack-upgrade.ts](../../packages/ontology/src/packs/pack-upgrade.ts) |
| [ZN-0216](../tickets/zn-0216.md) | Implement publisher recall and installation visibility | [packages/ontology/src/packs/publisher-governance.ts](../../packages/ontology/src/packs/publisher-governance.ts) |
| [ZN-0217](../tickets/zn-0217.md) | Define commercial entitlements and marketplace activation gate | [admissions/spec-037/marketplace-gate.json](../../admissions/spec-037/marketplace-gate.json.plan.md) |
| [ZN-0218](../tickets/zn-0218.md) | Prove runtime pack evolution across all audiences | [tests/journey/spec-037/pack-upgrade-journey.test.ts](../../tests/journey/spec-037/pack-upgrade-journey.test.ts) |

## Required proof boundaries

Resolve immutable dependencies and namespace collisions. Keep local overlays distinct from upstream pack bytes. Rebase upgrades with conflict handling and migration/open-work dispositions. Removal handles dependent definitions, data, active Cases/Watches and retention rather than deleting everything. Publisher signature/reputation is not a substitute for isolated evaluation and local approval.

V4 refinement: Pack upgrade/recall covers app definitions, immutable executable bindings, sessions and open Cases. A stable link resolves the admitted publication; it never follows a vendor latest alias or restores recalled code.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
