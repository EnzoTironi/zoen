# SPEC-052 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-052](../specs/spec-052.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Ontology and Product Runtime**. Module: `packages/ontology/src/apps`. Milestone: **S2**.

## Normative operation signatures

```text
ValidateMiniApp(definition,baseRelease) -> ValidatedManifest|Errors; InstantiateAppTemplate(template,parameters) -> DefinitionChange|InstanceAction; PublishApp(change) -> existing release process; OpenView(session,bindings) -> SemanticCalls through SPEC-050.
```

## State and transaction contract

MiniAppDefinition closes over appId, pages, approved component registry versions, query/action bindings, form schemas, requested capabilities, resource budget and accessibility labels. It is immutable release content. AppPublicationBinding(appId, manifestDigest, mode, optional artifactDigest, runtimeProfileRef) belongs to the released graph. Drafts remain existing builder_drafts; no mutable runtime latest alias is authority.

## Shared algorithm

```text
VALIDATE immutable app definition against approved component versions, typed bindings, resource limits and accessibility labels.
REJECT arbitrary script/HTML/eval/provider URLs/SQL and hidden data bindings in declarative mode.
RESOLVE query/action bindings to stable released semantic operations; presentation cannot manufacture authoritative metrics.
INSTANTIATE template parameters as ordinary allowed instance change only when semantics/powers stay unchanged.
FOR changed definitions use existing compile/evaluate/prepare/approve/activate path; create, publish and share are separate.
OPEN app through protected session and reuse the common semantic client for all data, subscriptions and exports.
RENDER read-only defaults, conflicts and missing values faithfully; consequential forms use trusted ActionCase confirmation.
UPGRADE/uninstall/recall through versioned release/artifact lifecycle; no mutable runtime latest alias as authority.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0302](../tickets/zn-0302.md) | Define bounded MiniAppDefinition and manifest schemas | [packages/ontology/src/apps/app-definition.ts](../../packages/ontology/src/apps/app-definition.ts) |
| [ZN-0303](../tickets/zn-0303.md) | Bind declarative app queries and forms to published operations | [packages/ontology/src/apps/app-bindings.ts](../../packages/ontology/src/apps/app-bindings.ts) |
| [ZN-0304](../tickets/zn-0304.md) | Publish app definitions through existing release activation | [packages/ontology/src/apps/app-publication.ts](../../packages/ontology/src/apps/app-publication.ts) |
| [ZN-0305](../tickets/zn-0305.md) | Ship the private read-only mini-app first-use journey | [tests/journey/spec-052/private-app-journey.test.ts](../../tests/journey/spec-052/private-app-journey.test.ts) |
| [ZN-0306](../tickets/zn-0306.md) | Bind mini-app forms to host-controlled ActionCase confirmations | [apps/web/src/mini-apps/app-actions.ts](../../apps/web/src/mini-apps/app-actions.ts) |
| [ZN-0307](../tickets/zn-0307.md) | Implement uninstall, recall and compatible app upgrades | [packages/ontology/src/apps/app-lifecycle.ts](../../packages/ontology/src/apps/app-lifecycle.ts) |

## Required proof boundaries

No eval, arbitrary HTML/script, provider URL, SQL or hidden direct data bindings in declarative mode. Operators and component versions are allowlisted and bounded. Queries use stable semantic IDs and exact authorized basis; display transformations cannot manufacture authoritative metrics. Create, publish and share are separate. Runtime compilation of an executable app is not app activation.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
