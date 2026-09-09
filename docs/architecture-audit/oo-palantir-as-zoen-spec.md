# Operational Ontology + Palantir Impact as Zoen product spec

**Status:** research memo (derived) — frozen into product law by [ADR-0001](../adr/ADR-0001-operational-ontology-os.md) (W0, 2026-09-09).  
**Provenance:** Adapted from `/workspace/zoen-arch-plan/research/oo-palantir-as-zoen-spec.md` (box research). Not an implementation claim.  
**Date:** 2026-09-09  
**Inputs:** Zhang _Operational Ontology_ (book zip); _The Palantir Impact_ markdown; Zoen tip `0536940` (W1–W4 ontology-plugin pivot).  
**Constraint from Enzo:** treat as product spec; AGI rewrite OK if needed.

## Spec in one page

The two documents describe the same product class:

1. **Operational layer** between data platforms and frontline action (not DWH, not chat memory).
2. **Nouns + verbs together:** Object / Property / Link (semantics) + Action / Function / dynamic security (kinetics).
3. **Governed write path** is the moat: auth → submission criteria → transactional ontology edits → audit/Action Log → side effects with honest compensation boundary.
4. **Agents:** LLM proposes; deterministic validator grants; MCP exposes Action cards as tools; Chat ≠ Decision ≠ Action modes; autonomy is earned.
5. **Branch/proposal** for ontology schema changes (PR for the world model).
6. **Platform shape:** Language (OMS) · Engine (object store, Actions, Functions, Funnel) · Toolchain (apps, inbox, SDK, MCP).

Zhang supplies depth (4C readiness, Action anatomy, failure modes). Palantir Impact supplies commercial framing (write-back, FDE, AIP, enterprise cases).

## What this does to Zoen identity

| Current Zoen (tip) | Spec target |
| --- | --- |
| Governed **World** for private truth (import, evidence, correct, share, erase) | Full **operational ontology OS** (any Object Types + Actions + Functions + Funnel) |
| MCP/CLI over World verbs | MCP/CLI as Action syscall table over any Action Type |
| Thin web Worlds host | Decision apps + Action Inbox + OSDK-class clients |
| Eve deleted; Muse owns chat | Chat agents are Mode-1 only; Decision/Action agents on ontology |
| ICP packs as journeys | Domain packs as ontology modules (healthcare/education/etc. in the book) |

**Verdict:** Spec is not a polish of tip Zoen. It is a **category promotion**: from “private-truth World product” to “Foundry-class operational ontology kernel” with Worlds as the first domain pack (or one of several).

## Gap map (honest)

**Already Zoen-shaped (keep / rename):**

- Semantic executor + receipts ≈ Action write path core
- Evidence / correction / sharing / erasure ≈ first Action Types + object families inside a World
- MCP tools = verbs ≈ Action projection (golden rule already matches)
- Subject identity ≈ entity resolution seed
- Branch via git/PR ≈ Ontology Proposal culture (process, not OMS yet)

**Missing for spec (must build if we adopt):**

- OMS: versioned Object/Link/Action Type registry (Language plane)
- Generic Object instance store + Link traversal (not only World-shaped tables)
- Action Type card: parameters, submission criteria, permissions, edits, function backing, side-effect declaration, modes, degradation
- Functions plane (derived props, staged writes)
- Funnel: merge pipeline sync + user edits without silent overwrite
- Action Log as first-class objects
- Approvals / human confirmation inbox
- Ontology Branching for schema (not only code git)
- Restricted views / property-level ACL
- Write-back adapters (side effects beyond World)
- Toolchain: Ontology Manager, Workshop-like builders (later)

**Do not import from Palantir blindly:**

- Funnel streaming constraints, MDO, Skywise-scale indexing
- FDE services business model
- AIP brand / Foundry lock-in
- Clone microservice names for marketing; keep Zoen domain language

## Rewrite vs evolve

With AGI rewrite allowed, **engineering cost is not the blocker**. Product sequencing is.

### Recommended: **Kernel rewrite, product wedge keep**

1. **Rewrite kernel** to Language/Engine/Security planes matching Zhang Ch.3–10 (typed state + guarded transitions).
2. **Migrate Worlds** as the first ontology pack: World, Evidence, Correction, Membership, Erasure become Object Types + Action Types on the new kernel (not a separate product).
3. **Keep tip assets that survive:** contracts schemas as seeds, MCP/CLI transport, Fly all-in-one ops, erasure fences, ICP journeys as acceptance packs.
4. **Defer:** Funnel at Airbus scale, Approvals enterprise UI, AI FDE, write-back to ERP/DCS until one live Action needs it.

### Rejected alternatives

- **Polish tip only:** never reaches Action Type / OMS; remains a World app while claiming Foundry category.
- **Big-bang Foundry clone:** years of surface area; loses ICP wedge and private-truth differentiation.
- **Replace with Zep:** wrong category (agent memory).

## How tip `0536940` changes under the rewrite

| Keep | Re-home | Delete / stop expanding |
| --- | --- | --- |
| World grammar + ICPs as pack | Onto Object/Action registry | Ad-hoc Eve remnants (already gone) |
| MCP verb surface | Generate tools from Action Types | Duplicating verbs in three apps by hand |
| Receipts / SERIALIZABLE commit ideas | Action Log objects | Claiming full operational ontology before OMS+Actions exist |
| Erasure qualification gates | Action Types with retention side-effects | Hosted erasure marketing ahead of proof |
| alchemy/Fly host | Host for Engine | Product = chat |

## Delivery waves (if Enzo confirms category promotion)

**W0 Spec freeze:** ADR + glossary (Object, Link, Action, Function, Submission Criteria, Action Log, World-as-pack).  
**W1 Language plane:** OMS MVP (types in git/versioned store).  
**W2 Engine write path:** Action runtime replacing ad-hoc executor switch.  
**W3 Worlds pack migration:** existing verbs as Action Types; MATRIX/acceptance green.  
**W4 MCP codegen** from Action registry.  
**W5 Funnel-lite** (one sync source) + Approvals-lite only if a real Action needs confirmation mode.

Normative acceptance criteria for these waves live in [docs/roadmap-oo-os.md](../roadmap-oo-os.md).

## Product fork — locked

**A. Zoen = Operational Ontology OS** (Language / Engine / Security; Worlds first pack). Matches book + Palantir Impact as primary spec.

Option B (Worlds product that only borrows OO vocabulary) is **rejected** as of W0 constitution lock 2026-09-09. See ADR-0001.
