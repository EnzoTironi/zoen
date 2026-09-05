# Cross-cutting protocol contract

This is a normative boundary contract. Per-spec operations add validated payload schemas; unsupported or missing definitions fail closed. Schema authoring is an implementation deliverable, not permission to invent semantics.

## Envelopes and transport

Mutations carry `schemaVersion`, `operation`, `operationId`, `worldRef`, `purpose`, `expectedBasis` (where relevant) and `input`. The authenticated principal, assurance and permitted audience come from verified server context, never trusted JSON fields. A request deadline is bounded by the server profile. Request/reply limits are explicit; the initial canonical envelope limit is 1 MiB, nesting 32, entries 10,000. Larger artifacts use staged byte streams and opaque authorized refs.

`worldRef = {worldId, realm: live|evaluation}`. A realm is checked at runtime, not merely branded in TypeScript. Offline is a separate scoped child World, not a third authority bypass. All mutation operation names are released semantic verbs; there is no arbitrary table/SQL tool. Authentication tokens and source secrets are never canonical intent payloads or persisted in chat.

`basis = {head: {releaseDigest,generationId,cellEpoch,securityRevision}, cut: DomainCut, readSetDigest, sourceCoverageRefs, clockSampleRef}`. A readSet includes row/object dependencies, identity resolutions, predicates/ranges/absence, source ACL/coverage, release/policy, exact observations and dataset snapshot refs relevant to the decision. A list of visible row versions alone is incomplete.

`DomainCut` is a sorted map of domain ID to committed version, scoped to one World/cell epoch. A frame pins a coherent database snapshot and explicit dataset set. Distributed Worlds retain separate cuts; a wall-clock timestamp is not a global snapshot.

## Outcomes

Every result is tagged: `Ok`, `InvalidInput`, `Unsupported`, `Denied`, `NotFoundOrDenied`, `Conflict`, `Stale`, `PreparationStale`, `Expired`, `Blocked`, `Unknown`, `Unavailable`, `HistoricalContentUnavailable`, `QuotaExceeded`, `LostLease`, `RetryableInfrastructureFailure`, or an operation-specific success/progress union. Error details must not reveal hidden data. A discovery-denied object uses an indistinguishable missing/denied result; an already authorized operation may expose a safe denial reason.

HTTP adapters use 200/201 for synchronous accepted results, 202 only for durable admitted work, 400 for invalid input, 401 for missing presence, 403 for safe disclosed denial, 404 for non-discoverable refs, 409 for conflict/stale, 410 for authorized expired/unavailable historical content, 413 for size, 429 for quota and 503 for unavailable/retryable infrastructure. The semantic result tag remains authoritative across CLI/MCP/WebSocket/SSE, not the numeric HTTP code. `Unknown` external status is a successfully retrieved observation of uncertainty, not proof of an HTTP failure.

## Idempotency and genesis

Normal mutation identity is `(World, principal, semanticOperation, operationId)` with a canonical intent digest. Same key+intent returns the same committed reference after fresh disclosure checks. A changed intent returns Conflict. The result record stores no transferable permission. Retryable transaction errors preserve the original consent/basis.

Genesis cannot start with a World key. Its unique operation scope is `(principal, CreatePersonalWorld, operationId)` in a bootstrap operations table; the chosen World ID, membership, head, receipt and outbox commit atomically using the same authority library. Database uniqueness serializes duplicates. Membership/authority never derives from channel presence.

## Core mutation algorithm

1. Parse/validate bounded input; verify presence; acquire fresh purpose/audience grant.
2. Resolve released semantic operation and canonical intent outside the transaction; do no provider or model I/O inside it.
3. Begin SERIALIZABLE, take WorldHead shared lock (genesis is the scoped special case), check current cell epoch, release, generation, security and emergency deny.
4. Acquire sorted declared domain locks, recheck current authorization and operation identity.
5. Validate complete guards, including phantom-safe predicate-domain versions. Reauthorize replay disclosure before returning an existing result.
6. Write semantic changes, touched domain versions, commit envelope, receipt and outbox in one transaction.
7. Commit. Only then may a worker claim delivery/execution. Retry serialization/deadlock at most three times with original intent/guards; return a retryable result afterward. Never silently refresh consent.

Head activation takes the exclusive head lock. Simple unrelated writes may proceed concurrently under shared head locks and disjoint domains. Predicates use conservative registered domain fences until a narrower proof exists; performance cannot replace correctness.

## Read and disclosure algorithm

Verify current grant; start a coherent read snapshot; bind head/cut/coverage/policy. Plan only authorized semantic operations. Filter field/object/evidence rights before ranking, aggregates, explanation and model context. Build a WorldFrame from authorized claims; pin exact data/observation versions. Before sending sensitive payloads or reopening delayed references, recheck revocation/emergency security revision. No stale cached grant in Focus or a persisted conversation becomes authority.

An undisclosed rival cannot influence visible confidence or ambiguity. A global enterprise interpretation may be offered only to an audience entitled to its dependencies or through an explicitly released declassification rule with its own tests.

## Scalars and time

Money and precise quantities are decimal strings, maximum precision 38 and scale 18; rounding and unit/currency conversion require explicit policy. No binary floating point for conservation. Integers exceeding I-JSON safe range, including Iceberg snapshot IDs, are strings. `LocalDate`, `Instant`, zoned wall time and half-open interval are distinct types. Unknown valid time is explicit, not insertion time. Host timezone, arrival order and language-model confidence cannot determine financial or temporal semantics.

## Dynamic changes

Instance data correction uses a released action. A reusable definition change uses candidate → evaluation proof → preparation → current-policy approval → atomic activation. New executable computation is an immutable signed sandboxed artifact. New privileged authority operations require reviewed kernel code/deploy. SDK runtime discovery may see newly activated operations immediately; compiled static types require regeneration. No arbitrary program text is interpreted as a trusted operation.

## State ownership and retries

The machine-readable state map and detailed transitions are in [state machines](state-machines.md). Test all illegal transitions and replays. An action receipt, transport acknowledgement, broker acknowledgement and final settlement are distinct artifacts. `cancel_requested` does not erase an already escaped effect. `Unknown` requires observation/reconciliation or an authorized explicitly warned decision, never automatic invented failure.


## Mandatory v4 surface closure

The [single semantic path](semantic-path.md) is binding for every human/agent/app ingress, discovery, read, mutation, export, callback and subscription. The existing dispatch implementation owns semantics. A bridge is a transport validator, not another authorization/data service. Context is server-bound; the application may only restrict. The structured path does not traverse Eve or require MCP.

The [protected-link protocol](protected-links.md) is an authority-free continuation into current sessions. The [app contract](mini-app-contract.md) binds version/meaning independently of current rights. PRIVATE asset retrieval is authorized as well as data operations. AppSession/Frame handles, opaque cursors and output refs never confer authority by possession.

The tagged result `ContractChanged` is added explicitly for an authorized incompatible manifest/client/session contract; do not translate it into a silent refresh. HTTP returns 409 for this tag. It does not reveal hidden symbols. Generic anonymous link responses never expose object existence. Details of revocation/send ordering and browser information-flow limits are in the normative [host contract](app-host-security.md).
