# SPEC-052 — Early declarative mini apps as released data

**Milestone:** S2 · **Owner:** Ontology and Product Runtime · **Root:** `packages/ontology/src/apps`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Most mini apps are immutable bounded definitions referencing existing semantic operations. Trusted renderer components run without generated JS, SQL or backend deployment. User and agent author the same definition/change operations; temporary presentation state is not company truth.

## Owned state and storage contract
MiniAppDefinition closes over appId, pages, approved component registry versions, query/action bindings, form schemas, requested capabilities, resource budget and accessibility labels. It is immutable release content. AppPublicationBinding(appId, manifestDigest, mode, optional artifactDigest, runtimeProfileRef) belongs to the released graph. Drafts remain existing builder_drafts; no mutable runtime latest alias is authority.

## Operations

```text
ValidateMiniApp(definition,baseRelease) -> ValidatedManifest|Errors; InstantiateAppTemplate(template,parameters) -> DefinitionChange|InstanceAction; PublishApp(change) -> existing release process; OpenView(session,bindings) -> SemanticCalls through SPEC-050.
```

## Execution protocol
No eval, arbitrary HTML/script, provider URL, SQL or hidden direct data bindings in declarative mode. Operators and component versions are allowlisted and bounded. Queries use stable semantic IDs and exact authorized basis; display transformations cannot manufacture authoritative metrics. Create, publish and share are separate. Runtime compilation of an executable app is not app activation.

Detailed contract: [mini-app definitions and lifecycle](../architecture/mini-app-contract.md). ZN-0203 supplies the trusted renderer at S2; these tickets supply its semantic definitions. Full S8 Studio reuses both.

## Pseudocode and file ownership

[algorithm SPEC-052](../algorithms/spec-052.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0302](../tickets/zn-0302.md) | Define bounded MiniAppDefinition and manifest schemas | component | [ZN-0078](../tickets/zn-0078.md), [ZN-0291](../tickets/zn-0291.md) |
| [ZN-0303](../tickets/zn-0303.md) | Bind declarative app queries and forms to published operations | component | [ZN-0083](../tickets/zn-0083.md), [ZN-0302](../tickets/zn-0302.md) |
| [ZN-0304](../tickets/zn-0304.md) | Publish app definitions through existing release activation | component | [ZN-0086](../tickets/zn-0086.md), [ZN-0303](../tickets/zn-0303.md) |
| [ZN-0305](../tickets/zn-0305.md) | Ship the private read-only mini-app first-use journey | journey | [ZN-0061](../tickets/zn-0061.md), [ZN-0203](../tickets/zn-0203.md), [ZN-0299](../tickets/zn-0299.md), [ZN-0304](../tickets/zn-0304.md) |
| [ZN-0306](../tickets/zn-0306.md) | Bind mini-app forms to host-controlled ActionCase confirmations | component | [ZN-0133](../tickets/zn-0133.md), [ZN-0138](../tickets/zn-0138.md), [ZN-0299](../tickets/zn-0299.md), [ZN-0305](../tickets/zn-0305.md) |
| [ZN-0307](../tickets/zn-0307.md) | Implement uninstall, recall and compatible app upgrades | component | [ZN-0172](../tickets/zn-0172.md), [ZN-0215](../tickets/zn-0215.md), [ZN-0306](../tickets/zn-0306.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `apps-charts-and-surfaces.md`, `runtime-variation-and-releases.md`. Read a named historical reference only when needed; it cannot override current contracts.
