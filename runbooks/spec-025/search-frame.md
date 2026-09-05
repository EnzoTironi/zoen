# File plan — `runbooks/spec-025/search-frame.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-025/search-frame.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-025](../../docs/specs/spec-025.md).
Tickets: [ZN-0149](../../docs/tickets/zn-0149.md).

## Responsibility and reuse

## ZN-0149 operational/repair procedure

Scope: Bind search results to evidence and freshness. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
The user asks for the latest value
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
BUILD permitted resource/field set at current rights cut before full-text/vector ranking.
SELECT only index documents with admitted source/deletion lineage and a declared projection cut.
RUN bounded retrieval/aggregation over authorized set; preserve stale-index/gap information.
REOPEN evidence through ordinary authorized operations before exposing bytes or grounding a model.
TREAT retrieved text as data; instructions inside it cannot install tools, roles or permissions.
START specialized agent only under released definition, explicit workload/delegation and parent Mandate limits.
REUSE context compiler, semantic client and budget conservation; cap fanout/recursion/egress.
ON revocation or lag beyond policy, stop affected delivery/work; do not fall back to unrestricted search.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
The result declares stale/partial status or recomputes within budget; it never labels old projection output current
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-025
Search(query,grant,bounds) -> AuthorizedSearchFrame | UnsupportedPlan; RetrieveEvidence(resultRef,freshGrant) -> Evidence; StartSpecializedAgent(definition,parentMandate,task) -> BoundedAgentRun.

ontology.search_documents(document_id PK,world_id,evidence_ref,source_revision,projection_cut,rights_label,text_vector,embedding_ref); ontology.embedding_jobs(job_id PK,source_ref,model_profile,rights_basis,state); ontology.agent_definitions are released data, not unbounded executable loaders. Index records carry deletion/source ACL lineage.

[algorithm SPEC-025](../../docs/algorithms/spec-025.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
