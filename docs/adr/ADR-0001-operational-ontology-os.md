# ADR-0001: Zoen is an Operational Ontology OS

- **Status:** Accepted (constitution lock)
- **Date:** 2026-09-09
- **Tip binding:** `main` @ `0536940`
- **Wave:** W0 — docs only; no kernel rewrite in this change

## Context

Tip Zoen (`0536940`) is a governed **Worlds** product: private truth with evidence, correction, sharing, and erasure over a semantic executor, exposed on web / CLI / MCP. Research against Zhang *Operational Ontology* and *The Palantir Impact* shows that the durable category is broader: an **operational ontology** platform (nouns + verbs + governed write path), not a chat memory store and not a day-one Foundry clone.

The product fork was:

- **A** — Zoen = Operational Ontology OS (Language · Engine · Security); Worlds is pack #1.
- **B** — Zoen = Worlds product that only borrows OO vocabulary.

Enzo locked **A** on 2026-09-09. This ADR is the constitution record. Glossary: [docs/glossary/operational-ontology.md](../glossary/operational-ontology.md). Wave plan: [docs/roadmap-oo-os.md](../roadmap-oo-os.md). Research memo (derived): [docs/architecture-audit/oo-palantir-as-zoen-spec.md](../architecture-audit/oo-palantir-as-zoen-spec.md).

## Decision

**Zoen is an Operational Ontology OS** with three planes:

| Plane | Role |
| --- | --- |
| **Language** | OMS — versioned Object / Property / Link / Action Types (schema of the world model) |
| **Engine** | Object store, Action runtime, Functions, Action Log; later Funnel-lite |
| **Security** | Auth, submission criteria, permissions, restricted views; golden rule: LLM proposes / validator grants |

**Worlds is ontology pack #1**, not a separate product. Current World verbs (import evidence, correct, share, erase, …) migrate onto Object Types + Action Types on the rewritten kernel. MCP and CLI remain the syscall surfaces; eventually MCP tools are **codegen from Action Types**, not hand-duplicated.

Surfaces stay high-signal OSS: web (thin host), CLI, MCP. No Eve / chat / voice product surface. No claim of Foundry parity.

## Sources

- Zhang, *Operational Ontology* — depth: 4C Decision Readiness, Action anatomy, failure modes, OMS shape.
- *The Palantir Impact* — commercial framing: write-back, nouns+verbs, AIP-style agents on ontology (inspiration only; keep Zoen language).

## Rejected alternatives

| Alternative | Why rejected |
| --- | --- |
| **Zep / Graphiti as kernel** | Wrong category (agent memory / temporal knowledge graph), not governed operational write path. |
| **Full Foundry clone day-1** | Years of surface area; loses ICP wedge and private-truth differentiation. |
| **Chat / Eve as product** | Already stripped; Mode-1 chat agents may exist later, but Decision/Action agents sit on the ontology. Product ≠ chat. |
| **Polish tip Worlds only (option B)** | Never reaches OMS + Action Types; remains a World app while claiming OO category. |

## Consequences

1. **Kernel rewrite** is in-scope for later waves (W1–W3): Language/Engine/Security matching the glossary — not a polish of ad-hoc executor switches alone.
2. **Migrate Worlds** onto the Action / Object registry (W3): existing semantic verbs become Action Types; MATRIX / acceptance stays green.
3. **MCP tools eventually codegen** from Action Types (W4); stop expanding hand-maintained verb triplication across apps.
4. **Defer** Funnel-at-scale, enterprise Approvals UI, ERP write-back until a live Action needs them (W5 lite only).
5. **This PR is docs-only.** Tip behavior and CI remain Worlds-as-today until later waves land code.
6. Standing constraints unchanged: never #51; no Eve revival; no prod destroy; Verify must stay green.

## Related

- Glossary: [operational-ontology.md](../glossary/operational-ontology.md)
- OO OS roadmap: [roadmap-oo-os.md](../roadmap-oo-os.md)
- Research memo: [oo-palantir-as-zoen-spec.md](../architecture-audit/oo-palantir-as-zoen-spec.md)
- Active product laws (still in force): [invariants.md](../invariants.md)
