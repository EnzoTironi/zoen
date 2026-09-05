# Single semantic execution path — normative v4 contract

**Owner:** Ontology. **Implementation:** existing `packages/ontology/src/surfaces/dispatch.ts` from SPEC-007. **Extension contract:** SPEC-050. This is not a new service, a fourth product, a second policy engine, or an LLM workflow.

## 1. One implementation, multiple transports

Human web UI, Eve's structured tools, autonomous delegated agents, CLI, REST, SDK, MCP, declarative apps, executable apps and admissible external hosts invoke the same `SemanticExecutor`. A trusted in-process adapter may call the same function; network-facing adapters authenticate and normalize their transport first. Neither in-process nor network invocation skips a stage of the executor.

`SemanticClient` exposes the published operation vocabulary, not repositories. The implementation registry, authorizer, query planner, interpretation rules, action guards and authority commit engine are shared. Copying policy code into each API is forbidden. The app bridge only authenticates its message channel, validates framing/limits and forwards an already-described semantic call. It adds restriction; it never supplies broader domain authority.

Eve is one client. Structured table loads do not call Eve, use tokens or ask a model to interpret an already-typed request. MCP is one transport, not the mandated transport for all clients. No new microservice per feature is required.

## 2. Operation and verified context

Use the [existing wire envelope](protocol-contract.md): schemaVersion, released operation, operationId where mutating/idempotent, worldRef, purpose, expectedBasis where required, and operation-specific input. Unknown top-level authority fields are rejected. `input` is validated against the released operation's exact schema; a domain targetPrincipal field is data, never proof of the caller's identity.

Only the trusted composition root constructs VerifiedRequestContext after authenticating a human session or workload identity. It binds subject, acting principal, delegation chain, tenant/realm, current assurance, purpose, admitted app installation/version, session ceiling, deadline, budget and current security revision. None is inferred from a URL, channel membership, package signature or request-body claim. Human and delegated-agent identity are audited distinctly.

Effective permission is the **intersection** of current subject/delegation rights, admitted app capabilities (when present), session purpose/scope and current source/disclosure restrictions. Application publisher rights are never part of that intersection. S2 uses the existing private-owner authorizer plus a restrictive app ceiling. S3 expands membership/delegation through the same admission interface and current Cedar policy; no second app-owned ACL store.

Execution order:

1. Parse bounded transport, verify presence/workload credential, bind fresh server context.
2. Resolve released operation and exact argument schema; intersect all current ceilings.
3. Admit a bounded plan; establish required temporal basis and complete read guards.
4. Run the one operation handler. Reads use disclosed evidence and one interpretation basis. Mutations use the existing guarded authority transaction. Network/model I/O stays outside that transaction.
5. Produce a tagged semantic result and disclosure label; stage any authorized bulk output separately.
6. Revalidate disclosure at the defined final send boundary; only then render/serialize for the client.
7. Record attributed operation/basis/result digests, not secrets, hidden rivals or raw private payloads.

A revoked/expired context cannot retrieve even an existing idempotent result. A bridge or runner may narrow the allowed operations further but may never admit an operation the executor denies.

## 3. Shared operation families

| Family | Common semantics | What may not be exposed |
|---|---|---|
| Discover | Current authorized SurfaceManifest definitions | Hidden fields/actions or catalog counts |
| Inspect / Explain / Search | WorldFrame, authorized interpretation, exact cut and provenance | Raw SQL, index endpoints, implicit global truth |
| Propose / Answer / Commit | Same ActionCase, current approval, stale checks, receipt | Direct app writes or a guest-controlled approved flag |
| Subscribe / Resume | Released plan, authorized bounded changes, gap/cursor semantics | Raw provider feed or handshake-lifetime authorization |
| Export / GetChunk | Same plan/basis, licensed disclosure and per-fetch current rights | Public bearer download for private data |
| Analyze / PublishOutput | Leased read-only inputs, explicit provisional output; separate admission | Silent app-computed business truth |
| Configure / Publish / Share | Existing governed mutation/release/membership operations | A builder backdoor or app-local access grants |

Internal data-plane ports remain specialized: PostgreSQL, vector search, Iceberg, object storage, feeds and source acquisition do not need to implement HTTP. They are behind the executor's admitted plan. Source connectors and effect workers use their already-governed internal lanes; those capabilities cannot be lent to app guests through a generic broker.

## 4. Batch, export and stream performance without shortcuts

Release a typed `BatchInspect`/query operation rather than issue one request per cell. Initial **design defaults**, not measured performance: at most 20 subplans, 200 rows/page, 50 columns/page, 1 MiB response, 30-second synchronous deadline and a separately admitted async export. Large authorized objects use staged chunks. Raising a limit changes the admitted profile; it cannot disable disclosure or return silent truncation.

A coherent multi-widget view requests one pinned Frame/batch basis. Separate live widgets must explicitly label distinct cuts rather than pretending they were atomic. Per-item denial cannot change a batch into an all-privilege operation. Mixed mutation batches are not implicitly atomic; an atomic domain operation must be separately defined and approved.

Cursor identity binds principal/delegation, app ceiling, World/realm, query digest, release, cut/snapshot, security revision and expiration. A cursor is a lookup handle, not authority. Reauthorization is required on every page, resume and download. Expired/incompatible cursors request a fresh plan; no silent merge of cuts. Authorization is applied before aggregation/ranking and at disclosure. Async export status does not grant access to its output.

Cache and runner partition keys include the same visibility/purpose dimensions. A shared appId is not a private-data cache key. Shared public immutable code can be reused; private runtime globals, SQLite, prompts, charts and serialized snapshots cannot cross subjects unless a separately admitted collaboration scope authorizes that exact disclosure.

Subscriptions have bounded queues and explicit gap handling. At final disclosure check, compare current rights/recall/security revision and fail closed on unavailable authorization. A send already authorized and linearized before revocation may arrive later; the system cannot retract network bytes or user copies. Tests revoke **before** the final disclosure check to prove denied new delivery, and separately test closure/cancellation of remaining work. No claim of retroactive secrecy.

## 5. Semantic equality and retry identity

Equivalent inputs include actor/subject/delegation, audience, purpose, app ceiling, released meaning, exact cut/read basis, source rights and request parameters. Compare normalized permitted facts, uncertainty/contestation, evidence refs, basis, result tags, consequence digest and stable receipts. Do not compare prose, widget order, generated request IDs or wall-clock telemetry. Never normalize away a denial, missing value, stale state, hidden-rival signal or changed consequence.

Same operationId + intent under the existing `(World, principal, semanticOperation, operationId)` scope has one result regardless of surface. Transport labels are not added to the key. Chat-to-app continuation retains the exact Case/operation identity. Independent user actions with distinct IDs are not deduplicated merely because their arguments match. Adding an app actor does not silently change the effective principal; verify delegation attribution explicitly.

## 6. Static and runtime enforcement

Only trusted composition/ontology adapters may import repositories or obtain data/source credentials. Client packages may import contracts and a narrow semantic client. Forbid direct and reexported/dynamic repository imports in client roots. Keep edge transport code separate from composition and test both import graph and credential/network reachability.

A route inventory accounts for HTML, private assets, source maps, errors, callbacks, /api, upgrades, streams, downloads and debug endpoints. Any new data-bearing route must identify the existing executor entry and required conformance suite. “Internal only” is not a waiver.

[No-bypass matrix](../testing/mini-app-conformance.md) and [v4 requirements](../backlog/v4-requirements.md) bind these rules to work and checks. Schemas validate wire shape only; real database/policy/browser/runner tests must establish enforcement.
