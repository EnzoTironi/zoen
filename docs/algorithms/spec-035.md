# SPEC-035 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-035](../specs/spec-035.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Builder Platform**. Module: `apps/web/src/studio`. Milestone: **S8**.

## Normative operation signatures

```text
EditDraft -> Draft; PreviewApp -> IsolatedPreview; PublishApp -> existing DefinitionChange process. AppBridgeRequest is a transport envelope for SemanticCall, not a domain data API.
```

## State and transaction contract

MiniAppDefinition is released meaning owned by Ontology. SPEC-052 owns definition/manifest contracts; SPEC-051 owns authority-free links and scoped execution sessions; SPEC-029 owns signed artifacts; SPEC-053 owns non-authoritative bridge/runner state. eve.builder_drafts remains non-authoritative authoring state. No app authority database.

## Shared algorithm

```text
OPEN a non-authoritative builder draft against a known base release with current editor rights.
EDIT stable semantic definitions through ordinary operations; no privileged database console.
REUSE existing definition compiler, early declarative renderer, protected sessions and host bridge.
SHOW semantic, consequence, lineage, capability and data-impact diff before evaluation/publication.
PREVIEW only within isolated evaluation realm using authorized test data and sinks.
PUBLISH through current-policy release preparation/activation; agent authoring has no privileged mode.
REUSE signed-artifact and admitted runtime contract only when custom executable behavior is necessary.
PROVE full consumer/professional/institutional journeys without rebuilding S2/S3/S6 mechanisms or introducing a second data path.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0202](../tickets/zn-0202.md) | Build Studio definition, rule and integration editors | [tests/journey/spec-035/studio-editors.test.ts](../../tests/journey/spec-035/studio-editors.test.ts) |
| [ZN-0203](../tickets/zn-0203.md) | Implement declarative operational app runtime | [apps/web/src/mini-apps/declarative-app.ts](../../apps/web/src/mini-apps/declarative-app.ts) |
| [ZN-0204](../tickets/zn-0204.md) | Implement isolated executable app origin and bridge | [apps/web/src/app-host/app-bridge.ts](../../apps/web/src/app-host/app-bridge.ts) |
| [ZN-0205](../tickets/zn-0205.md) | Implement negotiated MCP Apps delivery | [packages/clients/src/mcp-apps/mcp-apps.ts](../../packages/clients/src/mcp-apps/mcp-apps.ts) |
| [ZN-0206](../tickets/zn-0206.md) | Prove agent-generated application without new authority paths | [tests/journey/spec-035/app-journey.test.ts](../../tests/journey/spec-035/app-journey.test.ts) |

## Required proof boundaries

Reuse SPEC-050..054 without business logic in the bridge. Agent and human editors use the same runtime change operations. Full Studio composes the already-shipped declarative renderer, safe host, signed executable artifact and published operation manifest. It must not route reads through Eve/LLMs, access source credentials or create a second reconciliation engine.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
