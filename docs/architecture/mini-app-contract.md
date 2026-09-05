# Mini apps — one world, three implementation modes

**Normative owners:** SPEC-052 definitions, SPEC-051 session/continuation, SPEC-053 host, SPEC-029 artifacts, SPEC-014 publication. SPEC-035 composes these into the Workshop-like Studio. There is no new app-owned authority.

## Product and build sequence

A user asks for a useful operational view. Eve proposes or instantiates a released definition using the same editor operations a human uses. The system validates, evaluates and publishes under current policy, then creates an authority-free continuation. Sharing is a separate invitation/delegation action. Publication does not imply permission to send, share or perform an external action.

S1: private Focus continuation and authenticated browser handoff. S2: private read-only declarative applications and scoped sessions, without a new deployment. S3: sharing, fine-grained rights and three-client read parity. S4: governed consequential forms. S5: rich views and generated clients. S6: admitted executable hosts/backends/MCP delivery. S8: full Studio, lifecycle and three-audience capstone. No early ticket depends on a later milestone; the ticket DAG is authoritative.

| Mode | Produced artifact | Runtime / data path |
|---|---|---|
| Declarative (default) | MiniAppDefinition over closed component/query/action vocabulary | Trusted Zoen renderer + SemanticClient; no generated JavaScript or per-app server |
| Executable view | Signed frontend artifact plus definition/ceiling | Admitted isolated browser host, same SemanticClient; no backend required |
| Specialized backend | Signed artifact and immutable runtime preparation/binding | Qualified external runner, first Rivet candidate; same semantic client with request-bound capability |

A table, form, board or chart should not require a generated repository. Add a new trusted component only when a reviewed reusable need requires code; changing parameters, layout, bindings and released meaning remains governed data. Untrusted computations can return typed non-executable view documents to the trusted renderer. New privileged primitives still require reviewed core code.

## Definition and compilation

`MiniAppDefinition` includes schemaVersion, appId, title, rendererVersion, mode, pages, component trees, bindings, requested capabilities, budgets and optional artifactDigest. It references stable semantic IDs and operation-specific argument schemas. Code/egress/credentials/SQL are not fields in a declarative definition. JSON schemas are in [schemas](../schemas/mini-app-definition.schema.json); example fixtures are synthetic. Shape validation alone does not resolve bindings or grant rights.

The compiler uses the same release graph and SurfaceManifest. It checks dependency closure, compatible schemas/units, bounded layout, labels, operation classification, declared reads/actions and output types. View-derived money metrics reference released functions, not arithmetic invented in a formatter. Display sorting/formatting cannot change domain meaning. Missing, contested, stale and set-valued results remain representable.

Default bounds: 20 pages, 200 component nodes total, depth 16, 50 bindings total, 20 subplans per batch, 200 rows/page and 1 MiB response. These are proposed initial admission defaults; measured profiles may tune them through review. Unknown operators and limits fail explicitly. Only root rendering mode and artifact closure select executable mode; a JSON `script` property cannot smuggle code into declarative rendering.

## State and authorship

Ontological facts, memberships, source mappings, interpretations, business rules, receipts and settlements remain in Ontology. App-owned state is limited to local selection, transient sort/filter, navigation and explicitly labeled drafts. Persisting a draft is a governed storage operation with owner/retention; it is not a business commit. App-calculated values are provisional until separately admitted with evidence/lineage and current rights.

An app cannot configure a direct CRM/bank route outside source governance. Its request to add an integration becomes the same DefinitionChange/source binding operation a person or agent would use. Secret entry takes place in the trusted host, never guest HTML. No shared secrets in bundles, dependency scripts, logs or guest environment.

## Publication without a new activation system

The released `AppPublicationBinding` joins appId, manifestDigest, optional artifactDigest, allowed runtime profile and required proof closure. RuntimePreparation is non-authoritative job state. The active release graph owns the public binding. No runtime `latest`, app-local toggle or successful build can supersede the active graph.

1. Author a draft against exact base release with scope and intended outcome.
2. Compile closed definitions or build a signed immutable executable artifact outside authority.
3. Evaluate in EvaluationWorld using isolated synthetic/explicitly leased test inputs; live credentials and recipient channels cannot cross realms.
4. Prepare migration/reprojection and open-session/Case/Watch disposition. Runtime slot probes contribute evidence, not authorization.
5. Approve under **old/current** active policy and current delegation. Proposed permissions cannot approve themselves.
6. Atomically activate the prepared release; the host resolves its admitted app binding.
7. Create/send a continuation through existing operations. Send consent/channel admission is separate from app activation.

Presentation-only preferences can use an existing instance operation. A validated template instantiation is an instance only if the current release explicitly covers its bounded parameters. New semantics, capabilities, data export or permission changes use the appropriate release lane.

## Versioning, links and lifecycle

A stable link identifies an app and optional Focus. `current` means resolve the currently admitted publication at **new open**, not hot-swap an active form. `pinned` means request a historical manifest/view, reauthorize against current policy, and use an admitted safe renderer. Historical intent never re-enables recalled executable code. Record link basis intent separately from whether its referenced data is still retained.

An open AppSession pins its manifest/artifact and records current security revision, scope and expiry. Backward-compatible read refresh may establish a new Frame/session revision. Changes to action consequences, schema or permitted outputs produce explicit ContractChanged/Stale and require new consent. In-flight effects keep their original identity; app replacement does not replay them.

Recall/uninstall denies new sessions and calls immediately at the shared admission path, closes owned subscriptions and clears controlled caches. Reenabling requires governed policy/release approval. Historical receipts remain attributable; erased data and expired authority do not return. Code/cache already disclosed to a browser cannot be retroactively made unseen.

## Host-controlled actions

The guest may prepare arguments for a released action. The trusted host retrieves the Case and presents exact consequences, expiry, basis, recipient and required assurance. Approval is authenticated outside guest content and invokes the existing AnswerCase/Commit handler. An app message `approved=true` is not approval. User confirmations from chat and host use the same identity and stale guards; the agent cannot simulate a human click.

A form may propose low-risk changes without extra UI when a current bounded policy explicitly permits it; “silent” never means unauthenticated. Background work uses a workload identity/delegation and bounded Mandate, not a cached human session. External observed result is shown separately from receipt and desired outcome.

## Audience examples

Household: a bill view explains two amounts and asks a scoped clarification; caregiver access is explicit. Bakery: production board and money views share definitions but disclose different fields to owner and worker. Clinic: scheduling and receivables do not disclose clinical records. Enterprise: a reconciliation workbench includes source lineage, uncertain identities, dense tables, scoped approvals and an exact historical basis. These are packs and policies over the same execution implementation, not product forks.
