# SPEC-037 — Pack registry, overlays, upgrades and marketplace governance

**Milestone:** S8 · **Owner:** Developer Platform · **Root:** `packages/ontology/src/packs`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Packs are signed meaning/capability bundles, not automatic grants or cross-customer data sharing. Dependency upgrades are semantic release changes. Commercial marketplace availability requires publisher, support, security and entitlement controls beyond a package installer.

## Owned state and storage contract
ontology.pack_versions(pack_digest PK,publisher,namespace,version,dependencies,requested_capabilities,artifact_refs,signature_ref,license_ref); ontology.pack_installs(install_id PK,world_id,pack_digest,overlay_ref,granted_scope,state); ontology.publisher_records(publisher_id PK,verified_identity,signing_keys,review_state); ontology.marketplace_entitlements(entitlement_id PK,world_id,pack_ref,terms_version,state). No publisher can query installed customer data by default.

## Operations

```text
ResolvePackGraph(request,pinnedBase) -> LockedGraph; InstallPack(graph,overlay) -> Change; UpgradePack(install,target) -> SemanticDiff; RemovePack(install) -> DispositionPlan; VerifyPublisher(signature) -> VerifiedOrigin | Denied.
```

## Execution protocol
Resolve immutable dependencies and namespace collisions. Keep local overlays distinct from upstream pack bytes. Rebase upgrades with conflict handling and migration/open-work dispositions. Removal handles dependent definitions, data, active Cases/Watches and retention rather than deleting everything. Publisher signature/reputation is not a substitute for isolated evaluation and local approval.

V4 refinement: Pack upgrade/recall covers app definitions, immutable executable bindings, sessions and open Cases. A stable link resolves the admitted publication; it never follows a vendor latest alias or restores recalled code.

V4 normative detail: [single semantic path](../architecture/semantic-path.md).

## Pseudocode and file ownership

[algorithm SPEC-037](../algorithms/spec-037.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0213](../tickets/zn-0213.md) | Implement signed pack registry and dependency lock resolution | component | [ZN-0100](../tickets/zn-0100.md), [ZN-0173](../tickets/zn-0173.md), [ZN-0206](../tickets/zn-0206.md), [ZN-0212](../tickets/zn-0212.md) |
| [ZN-0214](../tickets/zn-0214.md) | Implement local overlays and semantic dependency mapping | component | [ZN-0213](../tickets/zn-0213.md) |
| [ZN-0215](../tickets/zn-0215.md) | Upgrade, rebase and remove packs safely | component | [ZN-0214](../tickets/zn-0214.md) |
| [ZN-0216](../tickets/zn-0216.md) | Implement publisher recall and installation visibility | component | [ZN-0215](../tickets/zn-0215.md) |
| [ZN-0217](../tickets/zn-0217.md) | Define commercial entitlements and marketplace activation gate | admission | [ZN-0216](../tickets/zn-0216.md) |
| [ZN-0218](../tickets/zn-0218.md) | Prove runtime pack evolution across all audiences | journey | [ZN-0216](../tickets/zn-0216.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `domain-packs-and-marketplace.md`, `runtime-variation-and-releases.md`. Read a named historical reference only when needed; it cannot override current contracts.
