# File plan — `admissions/spec-053/mcp-host-admission.json`

**Status:** planned; no product acceptance implied.

Target: `admissions/spec-053/mcp-host-admission.json`. Representation: **sidecar-only**. Allocation: **required**.

Specs: [SPEC-053](../../docs/specs/spec-053.md).
Tickets: [ZN-0313](../../docs/tickets/zn-0313.md).

## Responsibility and reuse

```text
PROCEDURE ZN_0313 /* planning label, not a public API */
  OWNER := SPEC-053; TARGET := admissions/spec-053/mcp-host-admission.json
  REQUIRE accepted dependencies: ZN-0205, ZN-0312
  REQUIRE evidence layer: admission; actual admitted services when needed
  IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
  IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
  USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
    LOAD approved publication and current app session in trusted host; select admitted declarative/executable disclosure profile.
    SERVE approved guest assets on isolated registered-site origin; strip credentials and never embed private bootstrap data.
    BIND exact frame window, artifact/session, nonce and MessageChannel before accepting bounded typed messages.
    FOR each permitted request call existing SemanticClient with verified server context; bridge owns no policy or business handler.
    DENY generic fetch/open-url/SQL/provider proxies; strip Cookie/Authorization/forwarded identity and unsafe response headers.
    ISOLATE mutable backend state by World/realm/principal/purpose/version/session unless explicit shared collaboration is admitted.
    REAUTHORIZE every call/stream/export and clear host-owned caches on revoke; close affected guests without promising to erase copied data.
    SHOW consequential confirmations in trusted chrome from server Case; guest approval text has no authority.
    DISCLOSE private data to executable code only under explicit qualified exposure profile; iframe/signature alone cannot prevent copying.
  TICKET-SPECIFIC SEGMENT:
    01. Negotiate the exact supported MCP Apps dialect and host capabilities without inventing universal support.
    02. Exercise shared SemanticClient tool calls and isolate host/provider scopes; mediate external host egress and confirmations.
    03. For insufficient host controls return structured text or a protected Zoen link, not a raw token/resource bypass.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN One admitted external host and one unsupported host request the same app
    WHEN The tool returns its UI resource under each negotiated profile
    THEN The admitted host respects source rights/session limits; the unsupported host receives the declared safe text/link fallback with no hidden data
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
