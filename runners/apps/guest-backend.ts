// @zoen-plan runners/apps/guest-backend.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `runners/apps/guest-backend.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `runners/apps/guest-backend.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-053](../../docs/specs/spec-053.md).
// Tickets: [ZN-0310](../../docs/tickets/zn-0310.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0310 /* planning label, not a public API */
//   OWNER := SPEC-053; TARGET := runners/apps/guest-backend.ts
//   REQUIRE accepted dependencies: ZN-0175, ZN-0176, ZN-0309
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     LOAD approved publication and current app session in trusted host; select admitted declarative/executable disclosure profile.
//     SERVE approved guest assets on isolated registered-site origin; strip credentials and never embed private bootstrap data.
//     BIND exact frame window, artifact/session, nonce and MessageChannel before accepting bounded typed messages.
//     FOR each permitted request call existing SemanticClient with verified server context; bridge owns no policy or business handler.
//     DENY generic fetch/open-url/SQL/provider proxies; strip Cookie/Authorization/forwarded identity and unsafe response headers.
//     ISOLATE mutable backend state by World/realm/principal/purpose/version/session unless explicit shared collaboration is admitted.
//     REAUTHORIZE every call/stream/export and clear host-owned caches on revoke; close affected guests without promising to erase copied data.
//     SHOW consequential confirmations in trusted chrome from server Case; guest approval text has no authority.
//     DISCLOSE private data to executable code only under explicit qualified exposure profile; iframe/signature alone cannot prevent copying.
//   TICKET-SPECIFIC SEGMENT:
//     01. Treat guest HTTP routes as untrusted computation, not a new database API.
//     02. Strip Cookie, Authorization, forwarded identity, internal grant and hop-by-hop headers; strip guest Set-Cookie and unsafe redirect response headers.
//     03. Provide a server-brokered request-bound semantic binding and per-subject execution state, with no provider/source/authority credentials.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN A worker and an owner alternate calls to one logical appId
//     WHEN Generated code retains a module variable and echoes inbound headers
//     THEN No owner data, token or identity header is available in the worker execution; guest cannot choose principal/partition; protected data is withheld when executable disclosure is not separately admitted
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
