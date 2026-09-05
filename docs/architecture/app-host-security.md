# Untrusted app host — authority isolation and honest information-flow limits

**Normative specs:** 050, 051, 053, 030. Browser and specialized backend are clients; neither owns domain permission. The signed artifact is an integrity/provenance claim, not proof that its code is benevolent.

## Threat model

Attacker can author generated code, send arbitrary bridge/proxy requests, control unrelated frames, forward a link, retain guest state, request source URLs, run expensive code and attempt credential theft. Attacker cannot be assumed to control the trusted browser/OS, trusted host signing keys or policy approvers. Users can copy what they are allowed to see. A compromised host is not repaired by an iframe.

Protect host credentials, current domain authorization, inter-user confidentiality, unpublished private assets, release binding, state partition, approval integrity and bounded resource use. Do not promise that a malicious app cannot copy **data deliberately disclosed to its code** on an unmanaged browser; see section 6.

## 1. Host/guest delivery

Trusted host: authenticated application with passkey/SSO and host-controlled confirmation chrome. Guest: cookieless isolated origin on a separate registrable domain, generic bootstrap only, no private name or app ID in URL. Serving generated code from the session origin is forbidden.

The trusted host obtains the private bundle after fresh semantic asset authorization, verifies its manifest/digest and transfers bytes/resources through a bound MessageChannel to the generic loader. Static app code can be shared by content digest; private results cannot. No third-party cookie dependency or token-bearing guest URL. The loaded artifact and renderer profile determine approved bootstrap/script mechanisms; dynamic execution belongs exclusively to executable mode, never a declarative escape hatch.

Start with restrictive sandbox and Permissions-Policy; no forms, popups, top navigation, downloads, camera, microphone, payment or service worker unless separately qualified. Exact permitted flags are recorded per host profile. Any `allow-same-origin` is only on a separate guest site, never same origin as host. Public loader site contains no credentialed APIs. Guest network APIs/resources are denied by CSP except required admitted blob/bundled resources; no arbitrary public egress allowance. Source maps stay private or are absent.

Do not accept a global `origin=null` or `targetOrigin=*` as authorization. The baseline uses the guest's exact origin and source window, then an entangled MessagePort, random frame nonce and publication digest. A future opaque-origin host requires its own proved bootstrap protocol and admission, not a relaxed global origin check.

## 2. Transport-only bridge

Handshake binds `(host session, appSessionRef, origin, sourceWindow, channelNonce, manifestDigest, artifactDigest, protocolVersion)`. The guest cannot choose this authority. Input message includes kind, requestId, channelNonce and a typed SemanticCall, with no credentials or principal. The host maps the frame's server session and calls SemanticClient. Request schema validation does not replace the operation-specific input schema.

Check exact message source/origin/nonce, type, limits, deadlines, sequence and pending-request budget. On navigation/reload/port transfer, invalidate the old binding and pending replies. Reject unknown operations rather than falling back to a general fetch, SQL, credential lookup or arbitrary URL opener. Same request/operation identity has the same retry semantics across transports.

Raw bridge calls cannot impersonate an approval. Host displays a fresh authoritative Case and collects explicit consent/step-up outside guest HTML. Content may ask to propose an action but cannot claim who approved it. Host does not trust a guest window size, title or progress badge as evidence of transaction outcome.

## 3. Backend proxy and runner

An optional specialized backend runs on the SPEC-030 admitted external containment profile, never in the process holding authority database credentials. It may receive a host-brokered request-bound capability to call the same executor, not a reusable human cookie/grant. A source-acquisition broker or effect broker is not exported as a guest app tool.

Before forwarding, remove Cookie, Authorization, Proxy-Authorization, forwarded identity/security headers, internal capability tokens and hop-by-hop headers; build the narrow allowlist explicitly. Validate Host/method/body/path canonicalization and WebSocket upgrades. Do not honor guest Set-Cookie, unsafe Location redirects, external resource injection or debug routes. A request ID is attribution, not authentication.

Partition all mutable guest process/SQLite/actor state by World, realm, subject/delegation, purpose, installation, immutable release and session/lease. Default: fresh isolated session execution; no appId-only warm instance for private data. Collaboration uses an explicitly admitted shared scope whose data visibility is safe for all participants. Signature does not permit private state reuse. No credential, source data or prompt snapshot in build artifacts.

Network egress, DNS/redirect validation, CPU, memory, file/output limits and cancellation are enforced outside guest code. Exact OS/container/runtime profiles must pass real G-RUNNER and G-APP-HOST proofs. Browser isolation does not substitute for backend containment.

## 4. Revocation, caches and send ordering

Final semantic disclosure checks run before new data dispatch. Revocation invalidates new calls, page cursors, export retrieval, resumed subscriptions, runner leases and direct alternate routes. Fail closed when current rights cannot be determined. Close queued work and destroy/recreate private guest state when its context shrinks; do not reuse previously broader plaintext state in a supposedly narrower session.

Cache identity includes complete purpose/visibility/basis; cache hit is not authorization. For streams, use an explicit final authorization barrier before each queued payload. A delivery linearized before a revocation may already be in flight; no retroactive byte recall is promised. Server/host clear only their controlled storage. A screenshot, downloaded output or hostile recipient memory is not retractable.

## 5. Admission and telemetry

G-APP-LINKS: real host login/continuation, recipient, cookies, previews and sharing. G-APP-HOST: actual browser isolation, bridge, private assets, backend containment and stated information-flow profile. G-MCP-APPS: each concrete external host/dialect and its controlled fallback. G-RIVET-DYNAMIC: exact selected vendor adapter and deployment. Dependencies do not turn a generic checkbox into production certification.

Evidence binds browser versions, domains/TLS, cookie/CSP settings, dependency/image digests, policy/disclosure mode, negative/fault results and independent reviewer. Do not store raw private values in runtime/debug logs or test reports. A changed host/runtime/policy reopens affected qualification.

## 6. Critical limitation: authority isolation is not universal browser DLP

An iframe/sandbox/CSP prevents specific capabilities; it does not establish a complete confidentiality theorem for arbitrary JavaScript given private data. `connect-src` restricts connection APIs, not every possible navigation or user-mediated channel. Do not rely on a nonexistent universal navigation block or claim a signature proves non-exfiltration. In particular, self-navigation and copied data must be included in the threat review. See primary references [MDN](../lineage/source-ledger.md).

Default for private data is declarative trusted rendering. For executable frontends choose an **explicit current-policy disclosure profile**, through the same purpose-bound grants:

- `trusted-renderer`: custom backend returns validated non-executable view/analysis documents; no raw protected data enters guest JavaScript.
- `reviewed-executable-disclosure`: an independently reviewed immutable frontend and its publisher are approved recipients of specified fields/purpose. Policy knowingly authorizes that disclosure and accepts the residual client-side copying/egress risk. It is not “zero egress by sandbox”.
- `managed-egress`: a separately qualified controlled browser/remote rendering/network environment provides the required stronger constraints. An unmanaged browser cannot be silently classified as this mode.

Highly restricted source policies may allow only trusted-renderer or a proven managed profile. Missing approval/profile returns Denied/Unsupported; use the trusted renderer or link fallback rather than weakening the policy. MCP hosts are subject to the same disclosure rule. Tests must prove that unapproved executable code receives **no protected data**, and report browser exfiltration limits for approved code rather than manufacture a pass. This refinement narrows a previously overbroad sandbox claim without creating another data path.
