# Repository, process and storage contract

## Target layout

```text
apps/
  edge/                  # Hono public edge and authenticated capability boundary
  web/                   # React relationship, Living World and Studio
  eve-worker/            # Turn-state execution, no authority database credentials
  authority-worker/      # Source/interpretation/release/attention jobs
  effect-worker/         # Restate adapter; narrow execution, no policy invention
packages/
  kernel/                # Pure validated values, schemas and tagged results
  contracts/             # Versioned semantic and port contracts, generated wire types
  door/                  # Better Auth adapter, presence and enterprise identity
  ontology/src/          # worlds, authority, evidence, identity, interpretation, ...
  eve/src/               # turns, context, relationship; ports into Ontology
  clients/               # REST/CLI/SDK/MCP adapters, one semantic vocabulary
  adapters/              # pg, S3, model, channel, catalog, broker implementations
  telemetry/             # Structured redacted instrumentation
packs/                   # Data-only foundation, household, bakery, clinic, finance, connectors
runners/                 # Isolated artifact execution profiles, not trusted kernel modules
infra/terraform/         # pilot and enterprise profiles, admission-specific environments
db/migrations/           # One ordered history, migrator-only DDL
contracts/               # JSON schemas/IR and release fixtures
journeys/                # Cross-surface acceptance suites
runbooks/                # Stop, repair, reconcile, restore, incident and rollback instructions
evidence/                # References to immutable CI artifacts, no secrets or personal data
```

This is a workspace with controlled dependency directions, not 50 independently deployed packages. Directory names in ticket allowed files are roots in the **target application repository**; execution-pack paths are separate. `tooling/` is the target build/test infrastructure, not a new production service.

## Imports and ownership

- kernel imports no application code, network client, environment reader, database or provider library.
- ontology imports kernel/contracts and receives ports. It never imports Eve or a channel-specific renderer.
- Eve imports released read/propose clients and conversation-owned adapters. It cannot access `pg`, S3 evidence credentials or arbitrary shell/file/web execution.
- adapters implement contracts; their providers do not define domain policy.
- web never holds source/provider secrets; all data/effects pass through semantic operations.
- packs declare meaning and behavior in closed IR. No customer-specific TypeScript in the kernel.
- runners are untrusted: network, secrets and outputs go through brokered leases.
- composition roots are the only place to join implementations and credentials. Static dependency tests enforce these edges.

## Process/security profiles

The pilot deploys only edge/web, Eve, authority jobs, PostgreSQL and object storage; model/channel routes remain individually gated. Effects, catalog, runners and institutional services are installed at their milestones. Shared image provenance is allowed; shared unrestricted credentials are not. Deployment templates must state which processes may reach each secret/network destination. An operating profile cannot weaken the semantic laws.

## Database ownership

`door` stores presence mappings and the admitted identity adapter's tables. `ontology` owns Worlds, membership, grants, semantics, evidence, Cases, releases, receipts, budgets and authoritative datasets. `eve` owns interaction/turn history. `channels` owns provider transport ingress/delivery state. `jobs` owns fenced lease/progress state. Separate migration owner and runtime roles; later cells may split databases while preserving the same ports.

The first authority migration creates SPEC-002 World/membership tables together with SPEC-003 authority tables. Genesis calls the same commit mechanism; Door does not write them. Table additions belong to the spec that introduces their semantics, but the migration directory is globally serialized. Every migration has empty-database, upgrade-from-previous, rollback/forward-repair and runtime-role tests.

Identifiers are opaque. Composite World/realm scope is checked on every foreign reference; foreign keys cannot silently link one tenant to another. Secrets are references, not plaintext columns. Monetary storage uses NUMERIC(38,18) or a tested narrower domain; wire values remain strings. Large revision/snapshot counters are string-encoded on the wire. Recorded commit timestamps do not replace an explicit committed knowledge cut.

## Ticket file boundaries

Each ticket lists exact primary deliverables and an allowlist including its own test, contract and runbook files. Creating an unexpected file requires a reviewed ticket amendment; a model may not broaden the allowlist to make a build pass. Shared migrations, kernel contracts and composition files are exclusive locks in the planner. A ticket may read any permitted dependency contract, but modifies only its declared files. Generated files require source changes and deterministic regeneration together.

## No accidental production scaffolding

Do not expose test clocks, kill switches, barriers, fixture seeders or fake provider endpoints in production images/routes. Production emergency deny is a separately authenticated audited capability, not the testing barrier mechanism. No placeholder provider returns success. No import of the Python reference model as a production engine. No default arbitrary agent tool access. No implicit upgrade to an unadmitted dependency.

## Integration is part of the ticket

A new file that is not wired into its intended public/worker path does not implement a behavior. Tickets explicitly permit their module entry/types/ports and narrowly named composition/registration files where needed. Shared composition edits hold an exclusive planner lock and may only bind the already declared ports for the current ticket. They never authorize broad credentials, new public test routes or a different architecture. Data packs modify manifests rather than adding TypeScript customer branches. Tests at early stages use the primitive introduced there; the later full journey must exercise that same primitive, not a second implementation.


## v4 mini-app boundary and reuse

`packages/ontology/src/surfaces/dispatch.ts` (SPEC-007) remains the only semantic executor. SPEC-050 extends its client/context contracts, not its ownership. `packages/clients/src/semantic-client.ts` is transport-facing. `packages/ontology/src/apps` owns released app definitions, and `packages/ontology/src/continuations` owns app/Focus registry and scoped sessions under ordinary operations. Door owns browser authentication challenges only.

`apps/web/src/mini-apps` is the trusted declarative renderer delivered in S2. `apps/web/src/studio` in S8 reuses it. `packages/clients/src/app-host` provides a transport-only bridge; `apps/web/src/app-host` composes it with trusted chrome. `packages/adapters/src/app-runtime/rivet` implements only the admitted runtime port. `runners/apps` executes outside the authority process and gets narrow request-bound semantic capability. No untrusted app imports Ontology repositories or receives source/provider/authority secrets.

One SPEC is not a separately deployed service. No app-local ACL/policy/reconciliation/data API, mutable authority cache, appId-only private runtime, generic guest fetch or server execution inside the authority process. Source/effect brokers are internal gated lanes, not application tools. Build config and VM policy are trusted outputs of reviewed configuration, never merged from generated code.

The same declared paths are permitted in the relevant tickets; `contract:semantic-executor`, `contract:continuation`, `composition:trusted-roots`, `schema:authority` and runtime/infra locks prevent conflicting writes. See [stage plan](mini-app-sequence.md).
