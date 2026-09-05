# Protected continuation and app-session protocol

**Owner:** SPEC-051. **Principle:** a URL identifies a destination; identity and authority come from a fresh authenticated session. This contract supersedes any example suggesting a bearer mini-app data link.

## Reference and ownership

Illustrative route: `https://app.zoen.example/open/<opaque-ref>`. `.example` is not an actual deployed domain. Generate at least 192 random bits for the reference. It is intentionally not a JWT, provider secret, World grant or presigned private dataset URL. Entropy reduces enumeration but is not the access check.

`CreateContinuation` and revocation are released idempotent mutations. The registry stores World/realm, Focus/app target, immutable version policy, optional recipient restriction, optional expiry and audit receipt. A link has active/revoked/expired state; no “used means permission granted” transition. Invites are separate existing records, not embedded in link tokens. Server retention applies to the registry itself.

Unrestricted-recipient means any *currently authorized* person may attempt to open, not public access. Recipient-bound means an additional intersection with an authenticated recipient. No group member or publisher privilege is inherited. App IDs, names, tenant identity, private icons, titles and source maps are sensitive unless explicitly released public.

## Public and authenticated routes

| Route | Authentication | Behavior |
|---|---|---|
| GET/HEAD `/open/:ref` | May be absent | Generic bootstrap only; never consumes a challenge, approves or discloses target existence |
| POST `/continuations/exchange` | Browser-bound Door proof + CSRF + exact Origin | Verify target and recipient, open current authorized Focus/AppSession; rotate session |
| POST `/semantic` | Verified host session/workload context | Common SemanticExecutor; no app-specific data API |
| GET `/app-assets/:opaqueRef` on trusted host | Current AppSession and approved binding | Authorized immutable bytes or non-discoverable denial; no tokenized public private-code URL |
| POST `/app-sessions/:ref/close` | Current subject or authorized revoker | Governed close and cancellation; handle alone cannot revoke another subject |

For valid-looking private references, anonymous and unauthorized clients receive a neutral landing/missing-denied presentation without target metadata. Timing side channels require measured review; do not claim mathematically identical network latency. Rate limiting and abuse telemetry do not include raw tokens or private names. Private responses use no-store/no shared cache, no-referrer and no third-party analytics before disclosure.

## Browser-bound exchange

Door owns a pending challenge: random challenge ID, hash of expected proof material, host session binding, target digest, intended authenticated subject constraint, expiry, attempts and state. Default proposal: 5-minute challenge TTL, at most 5 attempts, 30-minute idle AppSession, 8-hour absolute session maximum. These are configurable **upper bounds under admitted policy**, not promises of identity strength. Sensitive actions require step-up regardless of session age.

An existing appropriately assured Door session can continue without another ceremony. A new browser authenticates through an admitted passkey/IdP/profile. A WhatsApp-bound identity flow must verify the channel association and the browser session; receipt of a message is not proof of the browser user. For a recipient-bound sensitive link, a forwarded OTP/magic link alone is insufficient; require the actual authenticated recipient and current assurance. Never label a transferable bearer token “nontransferable”.

GET does not redeem. POST checks CSRF, exact Origin, browser session, challenge state, expiry, target, recipient and current World/app rights; then consumes the challenge atomically and rotates session identifiers. Concurrent exchange consumes at most once. Authentication/session fixation and open redirects are explicit negative cases. Return targets are registered local paths, never an arbitrary URL supplied by a guest.

## AppSession and fresh rights

The server creates a random opaque session ref bound to verified subject/actor, World/realm, purpose, scope, admitted publication/manifest/artifact, installation ceiling, assurance and expiry. The browser host retains its opaque handle in memory; trusted host authentication is an HttpOnly host-only Secure cookie. The handle is not a World grant. The guest receives only a transport binding for its own frame, never Door credentials or reusable internal capability proof.

S1 resolves Focus using the existing World session. S2 introduces private-owner app sessions with the same restrictive admission path. S3 expands that path with current membership/delegation/source-policy rights and recipient sharing. Do not delay the basic session primitive to S3 while claiming a protected S2 app.

Every operation, cache read, export retrieval, subscription/resume and backend call checks current authorization. App sessions can restrict but cannot expand access. Revoking a link blocks new opens and refreshes derived from it; default also terminates sessions derived from that link. Revoking an app/membership/installation blocks all affected sessions. A different independently valid link/session does not restore a revoked membership.

Sessions pin code/meaning, not old permissions. Compatible updates can return a new authorized view; incompatible updates require ContractChanged and fresh intent. Pinned historical app links do not run old revoked code. Expired data yields HistoricalContentUnavailable after authorized discovery. Logout closes current sessions, cancels delivery and clears controlled browser caches; user copies remain outside recall.

## Private assets without third-party cookies

The trusted host fetches private signed bytes using its authenticated session. A separate guest origin serves only a public generic loader with no tenant/app metadata. After exact-origin/window/channel binding, the host transfers authorized bundle/resources over a MessageChannel, checking digests; the loader runs them in the isolated origin. No private signed URL or third-party cookie is required for this bootstrap. Assets are bundled or fetched through the same host-mediated authorized resource operation.

This is the selected baseline delivery design, to be proven on actual supported browsers in G-APP-HOST. Raw slot IDs, guest origins and generic loaders expose no private app by themselves. A host/runtime that cannot support mediated bundle delivery requires reviewed replacement; do not “fix” it by putting a World token into an iframe URL. See the explicit information-flow limitation in [host security](app-host-security.md).

## Required test boundaries

Preview twice before actual open; forward to an outsider and a different already-authorized user; redeem from a copied browser session; replay after logout; reauthenticate a shared device; revoke before output; expire during exchange; change release while a Case is open; fetch asset/source map/export directly; fail authorization storage; open in embedded browser with disabled third-party cookies; restore an expired session database. Each has an explicit denial/continuation outcome in [test plan](../testing/mini-app-conformance.md). These product tests are not executed by package validation.
