# SPEC-025 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-025](../specs/spec-025.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Knowledge and Experience**. Module: `packages/ontology/src/retrieval`. Milestone: **S5**.

## Normative operation signatures

```text
Search(query,grant,bounds) -> AuthorizedSearchFrame | UnsupportedPlan; RetrieveEvidence(resultRef,freshGrant) -> Evidence; StartSpecializedAgent(definition,parentMandate,task) -> BoundedAgentRun.
```

## State and transaction contract

ontology.search_documents(document_id PK,world_id,evidence_ref,source_revision,projection_cut,rights_label,text_vector,embedding_ref); ontology.embedding_jobs(job_id PK,source_ref,model_profile,rights_basis,state); ontology.agent_definitions are released data, not unbounded executable loaders. Index records carry deletion/source ACL lineage.

## Shared algorithm

```text
BUILD permitted resource/field set at current rights cut before full-text/vector ranking.
SELECT only index documents with admitted source/deletion lineage and a declared projection cut.
RUN bounded retrieval/aggregation over authorized set; preserve stale-index/gap information.
REOPEN evidence through ordinary authorized operations before exposing bytes or grounding a model.
TREAT retrieved text as data; instructions inside it cannot install tools, roles or permissions.
START specialized agent only under released definition, explicit workload/delegation and parent Mandate limits.
REUSE context compiler, semantic client and budget conservation; cap fanout/recursion/egress.
ON revocation or lag beyond policy, stop affected delivery/work; do not fall back to unrestricted search.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0147](../tickets/zn-0147.md) | Build rights-carrying text and vector projections | [packages/ontology/src/retrieval/search-projection.ts](../../packages/ontology/src/retrieval/search-projection.ts) |
| [ZN-0148](../tickets/zn-0148.md) | Enforce authorization before ranking and aggregates | [packages/ontology/src/retrieval/authorized-search.ts](../../packages/ontology/src/retrieval/authorized-search.ts) |
| [ZN-0149](../tickets/zn-0149.md) | Bind search results to evidence and freshness | [packages/ontology/src/retrieval/search-frame.ts](../../packages/ontology/src/retrieval/search-frame.ts) |
| [ZN-0150](../tickets/zn-0150.md) | Contain source prompt injection at tool boundaries | [packages/ontology/src/retrieval/injection-containment.ts](../../packages/ontology/src/retrieval/injection-containment.ts) |
| [ZN-0151](../tickets/zn-0151.md) | Run specialized agents under explicit definitions | [packages/ontology/src/retrieval/specialized-agent.ts](../../packages/ontology/src/retrieval/specialized-agent.ts) |
| [ZN-0152](../tickets/zn-0152.md) | Prove retrieval and agent policies across source revocation | [tests/journey/spec-025/retrieval-journey.test.ts](../../tests/journey/spec-025/retrieval-journey.test.ts) |

## Required proof boundaries

Build the permitted source/object set before ranking. Do not retrieve hidden top-K then filter it afterward. Keep source cut and projection lag in results. Source text is untrusted data; it cannot redefine system instructions or install tools. Agents use the same semantic client, budget and context compiler, and cannot recurse outside released fanout limits.

V4 refinement: Retrieval and specialized agents use the single semantic executor. A vector index, cache or specialized model is an internal implementation detail, never an app-visible bypass.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
