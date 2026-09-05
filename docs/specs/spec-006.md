# SPEC-006 — Reversible domain identity and temporal explanations

**Milestone:** S1 · **Owner:** Knowledge · **Root:** `packages/ontology/src/identity`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Source record identity, human authentication and domain subject identity are different. A merge is a reversible versioned identity assertion; original source claims are never destructively reassigned.

## Owned state and storage contract
ontology.subjects(subject_id PK,world_id,created_commit); ontology.aliases(world_id,binding_id,namespace,external_id,valid_from PK,subject_ref,assertion_ref); ontology.identity_assertions(assertion_id PK,world_id,left_subject,right_subject,relation,valid_interval,knowledge_version,evidence_refs,supersedes); ontology.identity_cases(case_id PK,world_id,candidate_digest,basis_ref,state). No unique constraint on display name or email alone.

## Operations

```text
ProposeIdentityResolution(candidates,basis) -> ResolutionCase; ResolveIdentity(caseId,choice,operationId) -> IdentityReceipt; ExplainIdentity(subject,cut) -> AuthorizedIdentityFrame.
```

## Execution protocol
Emit candidates without selecting merely by fuzzy similarity. Explicit same-as/different-from assertions are scoped and versioned. Keep durable source subjects and compute the representative under a cut. Split appends counter-assertions and recalculates identity-dependent guards. Authorization is not widened by merge: unioning subjects does not union grants.

## Pseudocode and file ownership

[algorithm SPEC-006](../algorithms/spec-006.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0037](../tickets/zn-0037.md) | Implement namespaced aliases and stable subjects | component | [ZN-0036](../tickets/zn-0036.md) |
| [ZN-0038](../tickets/zn-0038.md) | Create guarded ambiguous-identity Cases | component | [ZN-0037](../tickets/zn-0037.md) |
| [ZN-0039](../tickets/zn-0039.md) | Implement merge assertions without physical destructive merge | component | [ZN-0038](../tickets/zn-0038.md) |
| [ZN-0040](../tickets/zn-0040.md) | Implement split and identity impact closure | component | [ZN-0039](../tickets/zn-0039.md) |
| [ZN-0041](../tickets/zn-0041.md) | Prove identity, label and time invariants | law | [ZN-0040](../tickets/zn-0040.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `identity-and-time.md`, `truth-reconciliation-and-learning.md`. Read a named historical reference only when needed; it cannot override current contracts.
