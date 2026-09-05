# SPEC-006 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-006](../specs/spec-006.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Knowledge**. Module: `packages/ontology/src/identity`. Milestone: **S1**.

## Normative operation signatures

```text
ProposeIdentityResolution(candidates,basis) -> ResolutionCase; ResolveIdentity(caseId,choice,operationId) -> IdentityReceipt; ExplainIdentity(subject,cut) -> AuthorizedIdentityFrame.
```

## State and transaction contract

ontology.subjects(subject_id PK,world_id,created_commit); ontology.aliases(world_id,binding_id,namespace,external_id,valid_from PK,subject_ref,assertion_ref); ontology.identity_assertions(assertion_id PK,world_id,left_subject,right_subject,relation,valid_interval,knowledge_version,evidence_refs,supersedes); ontology.identity_cases(case_id PK,world_id,candidate_digest,basis_ref,state). No unique constraint on display name or email alone.

## Shared algorithm

```text
GENERATE candidate links from authorized source identities and released match rules; similarity alone cannot merge.
PIN candidate set, evidence, valid interval and knowledge cut into a ResolutionCase.
RECHECK current authority and unchanged candidate basis before accepting same-as/different-from.
APPEND a scoped identity assertion and revision through the shared authority path; preserve original source subjects.
COMPUTE a representative at the requested cut without rewriting source IDs.
FOR split: append counter-assertions, recalculate identity-dependent interpretations and invalidate dependent Cases.
NEVER union permissions because subjects merge; re-evaluate rights per original source and resource.
EXPLAIN historical resolutions from authorized evidence without leaking hidden candidates.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0037](../tickets/zn-0037.md) | Implement namespaced aliases and stable subjects | [packages/ontology/src/identity/aliases.ts](../../packages/ontology/src/identity/aliases.ts) |
| [ZN-0038](../tickets/zn-0038.md) | Create guarded ambiguous-identity Cases | [packages/ontology/src/identity/identity-case.ts](../../packages/ontology/src/identity/identity-case.ts) |
| [ZN-0039](../tickets/zn-0039.md) | Implement merge assertions without physical destructive merge | [packages/ontology/src/identity/merge.ts](../../packages/ontology/src/identity/merge.ts) |
| [ZN-0040](../tickets/zn-0040.md) | Implement split and identity impact closure | [packages/ontology/src/identity/split.ts](../../packages/ontology/src/identity/split.ts) |
| [ZN-0041](../tickets/zn-0041.md) | Prove identity, label and time invariants | [packages/ontology/src/identity/identity-laws.ts](../../packages/ontology/src/identity/identity-laws.ts) |

## Required proof boundaries

Emit candidates without selecting merely by fuzzy similarity. Explicit same-as/different-from assertions are scoped and versioned. Keep durable source subjects and compute the representative under a cut. Split appends counter-assertions and recalculates identity-dependent guards. Authorization is not widened by merge: unioning subjects does not union grants.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
