# SPEC-053 — Isolated app host and transport-only bridge

**Milestone:** S6 · **Owner:** Platform Security and Browser Host · **Root:** `packages/clients/src/app-host`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Generated frontend code is hostile. Serve an immutable bundle on an isolated, cookieless app origin and mediate messages in trusted host chrome. A specialized backend runs outside authority with explicit leases. Bridge validation adds containment, not domain permission or business logic.

## Owned state and storage contract
No business authority store. Host-owned ephemeral bridge state records window identity, session binding, exact guest origin, channel nonce, request sequence, publication/artifact digest and bounded pending calls. Runner state keys include World/realm/principal/purpose/installation/version/session; shared collaboration is separately admitted. Private response/cache state is never keyed only by appId.

## Operations

```text
BindAppFrame -> BridgeBinding; TransportSemanticCall(binding,request) -> existing SemanticExecutor; CloseAppSession -> close/drain; StageStaticBundle(artifact) -> nonpublic immutable asset ref. Host confirmation invokes existing ActionCase operations.
```

## Execution protocol
Host-only HttpOnly secure sessions; no cookies/Authorization/X-Forwarded identity reach guest code. Default deny guest network APIs, top navigation, forms, popups, downloads and service workers; browser self-navigation is not assumed preventable. Private data enters executable frontends only under the admitted disclosure profile in the host contract. Exact allowed origins/MessagePort binding and typed messages prevent confused deputy calls. No generic fetch or direct provider broker. Untrusted runtime runs in qualified external containment, never inside the authority process.

[Browser and runner threat contract](../architecture/app-host-security.md). ZN-0204 composes this host with the existing application shell; it does not rewrite the bridge. Admission is independent of the declarative app path.

## Pseudocode and file ownership

[algorithm SPEC-053](../algorithms/spec-053.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0308](../tickets/zn-0308.md) | Provision isolated origins and signed private asset serving | component | [ZN-0171](../tickets/zn-0171.md), [ZN-0174](../tickets/zn-0174.md), [ZN-0299](../tickets/zn-0299.md) |
| [ZN-0309](../tickets/zn-0309.md) | Implement strict message bridge into the existing SemanticClient | component | [ZN-0293](../tickets/zn-0293.md), [ZN-0308](../tickets/zn-0308.md) |
| [ZN-0310](../tickets/zn-0310.md) | Strip credentials and isolate backend identity and mutable state | component | [ZN-0175](../tickets/zn-0175.md), [ZN-0176](../tickets/zn-0176.md), [ZN-0309](../tickets/zn-0309.md) |
| [ZN-0311](../tickets/zn-0311.md) | Enforce session revocation, streaming and host confirmation boundaries | component | [ZN-0157](../tickets/zn-0157.md), [ZN-0306](../tickets/zn-0306.md), [ZN-0310](../tickets/zn-0310.md) |
| [ZN-0312](../tickets/zn-0312.md) | Admit the real isolated executable browser-host profile | admission | [ZN-0179](../tickets/zn-0179.md), [ZN-0301](../tickets/zn-0301.md), [ZN-0311](../tickets/zn-0311.md) |
| [ZN-0313](../tickets/zn-0313.md) | Qualify negotiated MCP Apps host and safe link fallback | admission | [ZN-0205](../tickets/zn-0205.md), [ZN-0312](../tickets/zn-0312.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `apps-charts-and-surfaces.md`, `programmable-compute-and-skills.md`. Read a named historical reference only when needed; it cannot override current contracts.
