# SPEC-025 — Authorized retrieval and permitted specialized agents

**Milestone:** S5 · **Owner:** Knowledge and Experience · **Root:** `packages/ontology/src/retrieval`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Retrieval is a rebuildable projection, not truth. Authorization logically precedes ranking/aggregation. Initial search uses exact scoring within a bounded authorized candidate set; approximate indexes require their own visibility/recall admission. Specialized agents narrow capabilities and share budgets.

## Owned state and storage contract
ontology.search_documents(document_id PK,world_id,evidence_ref,source_revision,projection_cut,rights_label,text_vector,embedding_ref); ontology.embedding_jobs(job_id PK,source_ref,model_profile,rights_basis,state); ontology.agent_definitions are released data, not unbounded executable loaders. Index records carry deletion/source ACL lineage.

## Operations

```text
Search(query,grant,bounds) -> AuthorizedSearchFrame | UnsupportedPlan; RetrieveEvidence(resultRef,freshGrant) -> Evidence; StartSpecializedAgent(definition,parentMandate,task) -> BoundedAgentRun.
```

## Execution protocol
Build the permitted source/object set before ranking. Do not retrieve hidden top-K then filter it afterward. Keep source cut and projection lag in results. Source text is untrusted data; it cannot redefine system instructions or install tools. Agents use the same semantic client, budget and context compiler, and cannot recurse outside released fanout limits.

V4 refinement: Retrieval and specialized agents use the single semantic executor. A vector index, cache or specialized model is an internal implementation detail, never an app-visible bypass.

V4 normative detail: [single semantic path](../architecture/semantic-path.md).

## Pseudocode and file ownership

[algorithm SPEC-025](../algorithms/spec-025.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0147](../tickets/zn-0147.md) | Build rights-carrying text and vector projections | component | [ZN-0111](../tickets/zn-0111.md), [ZN-0146](../tickets/zn-0146.md) |
| [ZN-0148](../tickets/zn-0148.md) | Enforce authorization before ranking and aggregates | component | [ZN-0147](../tickets/zn-0147.md) |
| [ZN-0149](../tickets/zn-0149.md) | Bind search results to evidence and freshness | component | [ZN-0148](../tickets/zn-0148.md) |
| [ZN-0150](../tickets/zn-0150.md) | Contain source prompt injection at tool boundaries | component | [ZN-0149](../tickets/zn-0149.md) |
| [ZN-0151](../tickets/zn-0151.md) | Run specialized agents under explicit definitions | component | [ZN-0150](../tickets/zn-0150.md) |
| [ZN-0152](../tickets/zn-0152.md) | Prove retrieval and agent policies across source revocation | journey | [ZN-0151](../tickets/zn-0151.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `models-retrieval-and-agents.md`, `rights-and-access-control.md`. Read a named historical reference only when needed; it cannot override current contracts.
