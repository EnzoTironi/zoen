# Glossary — Operational Ontology (Zoen)

**Status:** Normative vocabulary for the OO OS constitution ([ADR-0001](../adr/ADR-0001-operational-ontology-os.md)), locked 2026-09-09.  
**Tip binding:** `main` @ `0536940`.  
**Tone:** Definitions are product law for future waves. Tip code may still use Worlds-native names until migration (W3).

## Core nouns

| Term | Definition |
| --- | --- |
| **Object Type** | Schema for a kind of thing in the operational model (fields, links, identity rules). Instances are Objects. |
| **Property** | Typed attribute on an Object Type (or derived via a Function). |
| **Link Type** | Typed relationship between Object Types (direction, cardinality, traversal rules). |
| **Object** | Instance of an Object Type under a World / ontology scope. |
| **OMS** | Ontology Management System — versioned registry of Object / Property / Link / Action Types (Language plane). |
| **Action Type** | Card describing a governed verb: parameters, permissions, submission criteria, ontology edits, Function backing, side-effect declaration, modes, degradation. |
| **Submission Criteria** | Deterministic gates that must pass before an Action applies (authz, preconditions, 4C readiness as required). Fail closed. |
| **Function** | Deterministic compute over ontology state (derived properties, staged edits, validations). Not an LLM call. |
| **Action Log** | First-class audit of Action attempts and outcomes (who, what, when, edits, side-effect status). Replaces “receipt-only” as the durable kinetics record. |
| **Funnel** | Pipeline that merges external sync + user edits without silent overwrite. **Lite later (W5)** — one sync source; not Airbus-scale day-1. |

## Decision readiness (4C)

Before an Action that requires readiness may grant:

| C | Meaning |
| --- | --- |
| **Correct** | Meaning matches intended types, units, identity, and scope. |
| **Complete** | Required coverage is present; unknown gaps are explicit, not invented zeros. |
| **Current** | Freshness / as-of time meets the Action’s criteria. |
| **Consistent** | No unresolved conflicts that the Action forbids (or conflicts are explicitly allowed). |

Absence of evidence is not completeness. Actions that need full coverage stay blocked.

## Agent modes

| Mode | Role |
| --- | --- |
| **Chat** | Mode-1 only — conversation / drafting. Does not mutate ontology authority. |
| **Decision** | Proposes Cases / Action parameters against current ontology state; still subject to grants. |
| **Action** | Submits Action Types through the Engine write path. |

Autonomy is earned per Action Type and profile — not a global “agent can write” switch.

## Golden rule

**LLM proposes / validator grants.**

Models may draft parameters, explanations, or candidate edits. The deterministic Engine (submission criteria + policy + commit) is the only grant path. MCP tools expose Action cards; they do not bypass the validator. Transport (web / CLI / MCP) never owns a parallel truth store.

## Map: current Zoen → OO terms

Tip language stays valid until Worlds pack migration. Mapping for writers and later codegen:

| Current Zoen | OO term / fate |
| --- | --- |
| **World** | Ontology pack scope + Object family (pack #1 container); not the whole OS. |
| **Evidence** | Objects + Links (source lineage / support) admitted under import Action Types. |
| **Correction** | Action Type(s) that edit interpretation / Object properties with scoped undo. |
| **Receipt** | Seed of **Action Log** (attempt + commit outcome); evolve into first-class Action Log objects. |
| **Erasure** | Action Type(s) with retention / suppression side-effects and qualification gates. |
| Semantic executor verbs | Action Types registered in OMS; MCP tools eventually generated from those cards. |
| Subject identity | Entity-resolution Object / Action family (seed, not a side product). |
| Share / revoke | Action Types over membership / access Objects. |
| ICP journeys (household, bakery, clinic, finance) | Acceptance packs / domain modules on the Worlds pack — not separate products. |

## Anti-glossary (do not invent)

- Do not rename marketing to Foundry / AIP / Skywise terms.
- Do not treat Zep/Graphiti memory graphs as OMS.
- Do not call Chat an Action surface.
- Do not claim Funnel or full Foundry parity before the matching wave acceptance criteria pass.

## Related

- [ADR-0001](../adr/ADR-0001-operational-ontology-os.md)
- [roadmap-oo-os.md](../roadmap-oo-os.md)
- [oo-palantir-as-zoen-spec.md](../architecture-audit/oo-palantir-as-zoen-spec.md)
