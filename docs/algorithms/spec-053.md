# SPEC-053 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-053](../specs/spec-053.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Platform Security and Browser Host**. Module: `packages/clients/src/app-host`. Milestone: **S6**.

## Normative operation signatures

```text
BindAppFrame -> BridgeBinding; TransportSemanticCall(binding,request) -> existing SemanticExecutor; CloseAppSession -> close/drain; StageStaticBundle(artifact) -> nonpublic immutable asset ref. Host confirmation invokes existing ActionCase operations.
```

## State and transaction contract

No business authority store. Host-owned ephemeral bridge state records window identity, session binding, exact guest origin, channel nonce, request sequence, publication/artifact digest and bounded pending calls. Runner state keys include World/realm/principal/purpose/installation/version/session; shared collaboration is separately admitted. Private response/cache state is never keyed only by appId.

## Shared algorithm

```text
LOAD approved publication and current app session in trusted host; select admitted declarative/executable disclosure profile.
SERVE approved guest assets on isolated registered-site origin; strip credentials and never embed private bootstrap data.
BIND exact frame window, artifact/session, nonce and MessageChannel before accepting bounded typed messages.
FOR each permitted request call existing SemanticClient with verified server context; bridge owns no policy or business handler.
DENY generic fetch/open-url/SQL/provider proxies; strip Cookie/Authorization/forwarded identity and unsafe response headers.
ISOLATE mutable backend state by World/realm/principal/purpose/version/session unless explicit shared collaboration is admitted.
REAUTHORIZE every call/stream/export and clear host-owned caches on revoke; close affected guests without promising to erase copied data.
SHOW consequential confirmations in trusted chrome from server Case; guest approval text has no authority.
DISCLOSE private data to executable code only under explicit qualified exposure profile; iframe/signature alone cannot prevent copying.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0308](../tickets/zn-0308.md) | Provision isolated origins and signed private asset serving | [packages/clients/src/app-host/app-origins.ts](../../packages/clients/src/app-host/app-origins.ts) |
| [ZN-0309](../tickets/zn-0309.md) | Implement strict message bridge into the existing SemanticClient | [packages/clients/src/app-host/bridge-transport.ts](../../packages/clients/src/app-host/bridge-transport.ts) |
| [ZN-0310](../tickets/zn-0310.md) | Strip credentials and isolate backend identity and mutable state | [runners/apps/guest-backend.ts](../../runners/apps/guest-backend.ts) |
| [ZN-0311](../tickets/zn-0311.md) | Enforce session revocation, streaming and host confirmation boundaries | [packages/clients/src/app-host/host-revocation.ts](../../packages/clients/src/app-host/host-revocation.ts) |
| [ZN-0312](../tickets/zn-0312.md) | Admit the real isolated executable browser-host profile | [admissions/spec-053/host-admission.json](../../admissions/spec-053/host-admission.json.plan.md) |
| [ZN-0313](../tickets/zn-0313.md) | Qualify negotiated MCP Apps host and safe link fallback | [admissions/spec-053/mcp-host-admission.json](../../admissions/spec-053/mcp-host-admission.json.plan.md) |

## Required proof boundaries

Host-only HttpOnly secure sessions; no cookies/Authorization/X-Forwarded identity reach guest code. Default deny guest network APIs, top navigation, forms, popups, downloads and service workers; browser self-navigation is not assumed preventable. Private data enters executable frontends only under the admitted disclosure profile in the host contract. Exact allowed origins/MessagePort binding and typed messages prevent confused deputy calls. No generic fetch or direct provider broker. Untrusted runtime runs in qualified external containment, never inside the authority process.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
