# Roadmap — Operational Ontology OS (W0–W5)

**Status:** Normative delivery waves for the category promotion in [ADR-0001](adr/ADR-0001-operational-ontology-os.md).  
**Locked:** 2026-09-09 · tip `0536940`  
**Source:** Derived from [architecture-audit/oo-palantir-as-zoen-spec.md](architecture-audit/oo-palantir-as-zoen-spec.md) (Zhang OO + Palantir Impact framing).  
**Scope note:** Existing [roadmap.md](roadmap.md) (D01–D22 / ZA frontier) remains the Worlds-era execution map until packs migrate. This file owns the **kernel rewrite waves**. Docs-only until W1 code starts.

## Wave overview

| Wave | Outcome | Code? |
| --- | --- | --- |
| **W0** Spec freeze | ADR + glossary + this roadmap + README framing | Docs only (this PR) |
| **W1** Language plane | OMS MVP — versioned types | Yes |
| **W2** Engine write path | Action runtime replaces ad-hoc executor switch | Yes |
| **W3** Worlds pack migration | Existing verbs as Action Types; acceptance green | Yes |
| **W4** MCP codegen | Tools generated from Action registry | Done (SI escape hatch) |
| **W5** Funnel-lite + Approvals-lite | One sync source; confirmation only if an Action needs it | Yes (optional triggers) |

## W0 — Spec freeze

**Goal:** Lock Zoen = Operational Ontology OS (Language / Engine / Security); Worlds = pack #1.

**Acceptance criteria**

- [x] [ADR-0001](adr/ADR-0001-operational-ontology-os.md) accepted: decision, sources, rejected alternatives, consequences.
- [x] [Glossary](glossary/operational-ontology.md) defines Object Type, Property, Link Type, Action Type, Submission Criteria, Function, Action Log, OMS, Funnel (lite later), 4C, agent modes, golden rule, Zoen→OO map.
- [x] This roadmap lists W0–W5 with acceptance criteria.
- [x] README product framing updated (OO OS; Worlds first pack; MCP/CLI; links ADR + glossary; no Foundry parity claim).
- [x] Research memo cited under `docs/architecture-audit/` as derived.
- [x] PR merged to `main` with Verify green (docs paths only).

**Out of scope:** Kernel rewrite, Eve revival, prod destroy, PR #51.

## W1 — Language plane (OMS MVP)

**Goal:** Versioned Object / Property / Link / Action Type registry (git and/or versioned store). Schema of the world model is data, not only TypeScript unions.

**Acceptance criteria**

- [x] OMS can register and version at least: one Object Type, one Link Type, one Action Type card (parameters + submission criteria stub + declared edits). (`@zoen/oms`)
- [x] Type changes go through an explicit proposal / review path (git PR acceptable for MVP; document upgrade path to in-product Ontology Branching). See [oms.md](oms.md).
- [x] Tip Worlds schemas are inventoried as **seeds** for pack migration (no silent delete of contracts).
- [x] Unit/integration proof: load registry → reject unknown Action Type id; accept known stub without executing Engine (Engine may still be tip executor).
- [ ] Verify green; no Eve surface.

## W2 — Engine write path

**Goal:** Action runtime is the governed write path: auth → submission criteria → transactional ontology edits → Action Log → side effects with honest compensation boundary.

**Status notes (in progress):** `@zoen/actions` ActionRunner wraps tip SemanticExecutor / ApplicationApi (dual path OK). Worlds pack Action Types encode → engine → append-only Action Log (`authority.action_log` migration 021). Unit proof: unknown ActionType rejected; param validation; CreatePersonalWorld happy path logs; criteria fail-closed / empty pass-through. MCP codegen deferred to W4. W3 migrates MCP/CLI Worlds pack call sites onto ActionRunner (HTTP SemanticExecutor emission dual path retained). See [actions.md](actions.md).

**Acceptance criteria**

- [x] At least one end-to-end Action Type executes solely through the Action runtime (not a one-off switch arm). (`worlds.CreatePersonalWorld` via ActionRunner)
- [x] Submission criteria fail closed; golden rule holds (no LLM grant path).
- [x] Action Log records attempt + outcome (maps from tip Receipt ideas).
- [ ] Side effects outside the authority transaction remain Unknown-until-reconciled (INV-aligned).
- [ ] SERIALIZABLE / fencing invariants preserved for the Action under test.
- [ ] Verify + targeted integration green.

## W3 — Worlds pack migration

**Goal:** Worlds is pack #1 on the new kernel. Import / evidence / correct / share / erase (and subject-identity where in tip) are Action Types + Object families — not a parallel product.

**Status notes:** MCP + CLI Worlds pack verbs execute through `@zoen/actions` ActionRunner (OMS lookup + Action Log) with ApplicationApi as Engine. Server composition provides `ActionRuntime` + PG Action Log (migration 021). HTTP Worlds groups remain on SemanticExecutor emission (dual path; receipts unchanged). **Subject-identity** stays on direct SemanticExecutor / ApplicationApi — OMS Action Types not added this wave (W1 waived; explicit escape hatch). Unit proof: CreatePersonalWorld Action Log on MCP/CLI/host path. No Eve. No Funnel (W5). See [actions.md](actions.md).

**Acceptance criteria**

- [x] Tip World verbs used by web/CLI/MCP are registered Action Types (or thin adapters proven equivalent). (MCP/CLI ActionRunner adapters; web still ApplicationApi → server SemanticExecutor)
- [ ] MATRIX / acceptance journeys for named ICPs stay green (household, bakery, clinic admin, finance as currently qualified).
- [x] Erasure / retention gates remain Action Types with side-effect declaration — no hosted erasure marketing ahead of proof.
- [x] No second semantic executor for “legacy Worlds.” (ActionRunner wraps tip executor; subject-identity documented exclusion)
- [ ] Verify green; Eve remains absent.

## W4 — MCP codegen

**Goal:** MCP (and CLI help surface where applicable) generate tools from the Action Type registry instead of hand-duplicating verbs across apps.

**Status notes:** `@zoen/oms/mcp-codegen` lists Worlds Action Types (inventory order, then any extra registered Worlds ops); `apps/mcp` `generateWorldsToolsFromOms` + host binders assemble tools. Subject-identity remains a hand escape hatch (no OMS stubs). CLI root help surfaces `oms-actions.ts` OMS name list. No Funnel (W5).

**Acceptance criteria**

- [x] Adding a new Action Type yields an MCP tool without a hand-written third copy of the verb in `apps/mcp` (binder required; name from OMS).
- [x] Generated tools still assemble SemanticRequest / Action submit through the Engine grant path (W3 ActionRunner).
- [x] Web / CLI / MCP catalog + CreatePersonalWorld routing under test (OMS name catalog shared across MCP/CLI help; CreatePersonalWorld dispatch proof — not full per-verb cross-surface matrix).
- [x] Document escape hatch for subject-identity hand binders (direct-engine ops excluded from OMS/ActionRunner; not all read-only) — must not mutate ontology authority via a parallel grant path.
- [ ] Verify green.

## W5 — Funnel-lite + Approvals-lite

**Goal:** Only what a real Action needs — not Airbus-scale Funnel or enterprise Approvals UI.

**Acceptance criteria**

- [ ] **Funnel-lite (optional):** one external sync source merges with user edits without silent overwrite; conflicts explicit.
- [ ] **Approvals-lite (optional):** confirmation mode for Action Types that declare it; inbox minimal; no fake “AI FDE.”
- [ ] Skip either sub-wave if no live Action requires it — record the deferral in progress notes.
- [ ] Still no Foundry parity claim; still no Eve product.

## Standing constraints (all waves)

- Docs or code PRs against `main`; one writer per branch.
- Never reopen #51; no Eve / chat / voice product revival; no prod destroy.
- Verify must stay green; Greptile credit-limit → Qodo + CI sufficient to merge when policy allows.
- Do not claim Foundry / AIP parity in README or release notes.

## Related

- [ADR-0001](adr/ADR-0001-operational-ontology-os.md)
- [glossary/operational-ontology.md](glossary/operational-ontology.md)
- [architecture-audit/oo-palantir-as-zoen-spec.md](architecture-audit/oo-palantir-as-zoen-spec.md)
- Worlds-era map: [roadmap.md](roadmap.md)
