# Execution constitution — v4 product / v5 workspace

Status: normative execution design, not evidence of an implemented system. Baseline date: 2026-09-04.

## Authority and precedence

User ambition → this constitution and explicit v4 refinements plus organizational amendment 066 → current normative specs → versioned tickets/test oracles → non-executable file plans → archived design references → examples. A ticket may narrow scope; it cannot weaken an invariant. When two normative statements conflict, execution stops with `SpecConflict`; a reviewer resolves the spec and regenerates the affected artifacts before work resumes. No model chooses the more convenient interpretation. The capability inventory C001–C157 is the finite required scope of this release; new requests enter through reviewed change control rather than an invented claim of universal coverage.

The target remains one product grammar for consumers, professionals and institutions. Different domain packs, operational profiles and rights do not create three kernels. The financial market is a reference for temporal, evidential and operational rigor; proprietary datasets, licenses, adoption and regulatory permissions are not delivered by architecture.

## Non-negotiable laws

| ID | Requirement | Mandatory adversarial witness |
|---|---|---|
| INV-01 | Door proves presence; Ontology grants domain authority; Eve owns relationship state. | Direct Eve-to-authority-database import or credential access is denied. |
| INV-02 | Evidence, attributed claim, interpretation, decision, attempted effect and observed settlement remain distinct. | A user's “paid” message never creates a bank Settlement. |
| INV-03 | Reconciliation compares meaning, identity, scope, unit and time before comparing values. | Booked 1000, invoiced 800 and received 600 are not one conflict. |
| INV-04 | Copied sources do not constitute independent support. | Ten copies count as one family; lineage is preserved. |
| INV-05 | A user answer has an explicit kind and scope; local correction does not install a reusable rule. | Correcting one order changes no other order or RuleDefinition. |
| INV-06 | Every read, replay, resumed action and delayed disclosure uses current authorization. | Revocation before delivery suppresses sensitive content. |
| INV-07 | Hidden evidence is absent from observable content, counts, ranking, confidence, errors and model context. | Paired Worlds differing only in hidden evidence produce equivalent permitted views. |
| INV-08 | Decisions bind an exact released meaning and complete read dependency set, including predicates and absence. | A newly inserted matching invoice makes a pending aggregate-based Case stale. |
| INV-09 | One local authority transaction commits semantic state, receipt and outbox; network/model work is outside it. | Kill at every transaction boundary yields all or none. |
| INV-10 | Same operation identity and intent yield one semantic result; changed intent conflicts; replays are reauthorized. | Concurrent retries create one receipt without revealing it to a revoked actor. |
| INV-11 | Durable workers use fencing; durable execution is not proof of exactly-once external effects. | A lost reply after provider acceptance stays Unknown until reconciliation. |
| INV-12 | User/agent variation is data within admitted capabilities; new privileged execution requires separately reviewed code. | A candidate release cannot grant its author or agent approval authority. |
| INV-13 | Evaluation and live realms cannot share authority, credentials, effect destinations or recipient identities. | An evaluation action cannot reach a live bank or real person. |
| INV-14 | Published datasets bind exact snapshots and physical retention pins before authority publication. | Concurrent catalog GC cannot destroy a published snapshot. |
| INV-15 | Live observations are ephemeral until exact authorized capture; gaps and entitlement expiry are explicit. | A conflated/latest price cannot silently replace a consent-bound observation. |
| INV-16 | Mandates are bounded by scope, action allowlist, budget, deadline, stop and observable outcome. | Child reservations of 70+70 cannot exceed a root limit of 100. |
| INV-17 | A World has one active writer cell/epoch. Promotion requires actual source fencing, not only a directory update. | An unreachable old primary cannot be replaced unless independently fenced. |
| INV-18 | Federation has independent local cuts and approvals; no global ACID or global truth clock is asserted. | One remote rejection leaves an explicit partial outcome. |
| INV-19 | Erasure, retention, holds and restoration are executable policies, including derivatives and backups. | An old backup cannot revive content on the erasure suppression ledger. |
| INV-20 | Completion is evidence-bound to commit, dependency lock, operating profile and required checks. | A green build with an unexecuted required test cannot complete a ticket. |

| INV-21 | Every human, agent, mini app and programmatic data operation executes through the same SPEC-007 semantic implementation. | An app-only SQL/export/stream or duplicated policy handler fails conformance. |
| INV-22 | A continuation URL is authority-free; each session/use intersects current subject, app, purpose and source rights. | A forwarded link cannot lend publisher privilege or reveal protected metadata. |
| INV-23 | Build/runtime stage, published meaning, granted access and external result are independent facts. | Successful Rivet deployment cannot publish or authorize the app. |
| INV-24 | App execution is isolated; protected guest disclosure requires an explicit admitted information-flow profile. | No private data is released to unapproved executable frontend code; an iframe is not claimed as universal browser DLP. |

## Retained v3 refinements to v2

1. **Bootstrap dependency:** SPEC-002 presence is independent. SPEC-003 implements the shared authority primitive and initial World/membership tables. SPEC-002 genesis then consumes that primitive. No second bootstrap transaction engine.
2. **Representative contracts:** v2 sample SQL and TypeScript are design examples, not authoritative complete migrations. The v3 protocol and per-spec storage contracts govern implementation; schema generation and migration tests are ticketed deliverables.
3. **State axes:** Interpretation remains `unknown | unresolved | selected | set-valued`, with independent verification and contestation. ActionCase adds explicit `blocked` and `cancelled` outcomes. No untyped `done` or conflation of cancelled intent with cancelled external reality.
4. **Evidence policy (amended by 066):** pure-law/property tests exercise actual pure modules. Service tests use actual admitted database, policy, store, browser, runner and provider profiles with synthetic authorized input records. No protocol simulator, mock provider or offline success fallback substitutes a service in this workspace. Missing dependencies remain blockers.
5. **Admission versus implementation:** missing external credentials or licenses block their route's admission, not independent coding. Core toolchain admission still precedes all implementation. The initial file/web path cannot be held hostage by a WhatsApp contract.
6. **Early hosting:** SPEC-049 supplies a qualified shared pilot in S1. Enterprise S9 adds measured institutional controls rather than becoming a hidden prerequisite for first use.
7. **Ownership refinement:** world genesis, memberships, invitation consumption and domain grants are Ontology code even when introduced in a Door-related spec. Better Auth's own storage belongs to Door only.

## Design economy

One semantic implementation serves UI, conversation, agents, declarative/executable mini apps, API, CLI, SDK and MCP. Adapters only translate transport; no LLM on typed app reads. One authority commit mechanism; one interaction journal; one release compiler; one effect intent/settlement grammar. Do not create a microservice per spec or profession. Install dense analytics, runners, dedicated cells and federation only when their milestones need them. Ports preserve replaceability; duplicate authorities destroy it.

A primitive is added only when its invariant cannot be expressed by an existing one, its owner is unique, and a failing test demonstrates the need. Domain variation lives in definitions/packs, not `if customer` branches. Shared code is extracted only after two concrete uses demonstrate identical semantics; no speculative generic orchestration framework.

## Unknowns that must remain visible

Actual OS production inventory, current provider contracts, licensed source coverage, jurisdictional clinical/financial approvals, cloud accounts and measurable customer workloads require external evidence. Named admission gates own these inputs. Neither this pack nor a coding agent can substitute a guessed answer. No component is marked implemented by this delivery.


## v4 amendments and precedence

[ADR-062](amendments/062-one-semantic-path.md), [ADR-063](amendments/063-apps-links-and-sessions.md), [ADR-064](amendments/064-rivet-runtime-binding.md) and [ADR-065](amendments/065-progressive-app-sequencing.md) form the current v4 product contract. The detailed [semantic](semantic-path.md), [app](mini-app-contract.md), [link](protected-links.md), [host](app-host-security.md) and [runtime](rivet-adapter.md) contracts are normative. Preserved history is compressed in `archives/zoen-execution-v4.zip`; older lineages inside that archive are historical, not a second source of current instructions. Amendment 066 governs this workspace's organization and stricter no-service-substitute execution policy.

Do not blindly carry accepted v3 evidence into v4. Reopen changed ticket contracts and their affected dependents as recorded in [change report](../lineage/source-ledger.md). This delivery contains no accepted application tickets.

## Visual maps

[Mini-app architecture diagrams](mini-app-diagrams.md) show the shared semantic path, protected opening, isolated publication and progressive delivery. They are editable views of these contracts, not separate authorities.
