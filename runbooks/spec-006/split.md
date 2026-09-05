# File plan — `runbooks/spec-006/split.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-006/split.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-006](../../docs/specs/spec-006.md).
Tickets: [ZN-0040](../../docs/tickets/zn-0040.md).

## Responsibility and reuse

## ZN-0040 operational/repair procedure

Scope: Implement split and identity impact closure. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
The steward splits it
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
GENERATE candidate links from authorized source identities and released match rules; similarity alone cannot merge.
PIN candidate set, evidence, valid interval and knowledge cut into a ResolutionCase.
RECHECK current authority and unchanged candidate basis before accepting same-as/different-from.
APPEND a scoped identity assertion and revision through the shared authority path; preserve original source subjects.
COMPUTE a representative at the requested cut without rewriting source IDs.
FOR split: append counter-assertions, recalculate identity-dependent interpretations and invalidate dependent Cases.
NEVER union permissions because subjects merge; re-evaluate rights per original source and resource.
EXPLAIN historical resolutions from authorized evidence without leaking hidden candidates.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
The purchase Case becomes stale, ambiguous derived data is flagged and historical receipts remain explainable
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-006
ProposeIdentityResolution(candidates,basis) -> ResolutionCase; ResolveIdentity(caseId,choice,operationId) -> IdentityReceipt; ExplainIdentity(subject,cut) -> AuthorizedIdentityFrame.

ontology.subjects(subject_id PK,world_id,created_commit); ontology.aliases(world_id,binding_id,namespace,external_id,valid_from PK,subject_ref,assertion_ref); ontology.identity_assertions(assertion_id PK,world_id,left_subject,right_subject,relation,valid_interval,knowledge_version,evidence_refs,supersedes); ontology.identity_cases(case_id PK,world_id,candidate_digest,basis_ref,state). No unique constraint on display name or email alone.

[algorithm SPEC-006](../../docs/algorithms/spec-006.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
