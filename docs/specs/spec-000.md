# SPEC-000 — Execution baseline, dependency admission and fail-closed CI

**Milestone:** S0 · **Owner:** Platform · **Root:** `tooling`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Adopt current v4 ownership and technology families. Create a new implementation in zoen; OS remains a read-only migration source until explicit cutover approval. Do not interpret a package publication as composition proof. Python execution-pack tooling is documentation tooling, not a production service.

## Owned state and storage contract
No application tables. Track execution-lock.json, baseline-inventory.json and evidence-index.json as reviewed artifacts. Secret values never belong in these files.

## Operations

```text
AdmitExecutionProfile(profile, candidateVersions, integrityDigests, compatibilityReport) -> AdmittedLock | Blocked; VerifyTicket(ticketId, commit, profile) -> EvidenceReport | MissingPrerequisite.
```

## Execution protocol
Freeze repository commit identities before reuse. Admit a core lock first and extension locks just before their milestone. The lock must include Node, pnpm, TypeScript, Hono, pg, PostgreSQL, Cedar binding, schema validator, canonicalizer, test tools and image digests. One workspace; ontology submodules are directories, not dozens of independent services. Missing tests are failures, never successful empty runs.

V4 refinement: V4 is the execution source of truth. Preserve the input-v3 archive and stable IDs; compile a no-bypass import/credential graph for app, agent and human clients.

V4 normative detail: [single semantic path](../architecture/semantic-path.md).

## Pseudocode and file ownership

[algorithm SPEC-000](../algorithms/spec-000.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0001](../tickets/zn-0001.md) | Record repository and data-preservation baseline | admission | None |
| [ZN-0002](../tickets/zn-0002.md) | Admit the exact core toolchain | admission | [ZN-0001](../tickets/zn-0001.md) |
| [ZN-0003](../tickets/zn-0003.md) | Create workspace, strict build and dependency boundaries | static | [ZN-0002](../tickets/zn-0002.md) |
| [ZN-0004](../tickets/zn-0004.md) | Create real dependency test harness with explicit clocks and barriers | component | [ZN-0003](../tickets/zn-0003.md) |
| [ZN-0005](../tickets/zn-0005.md) | Enforce evidence-bound pull-request completion | static | [ZN-0004](../tickets/zn-0004.md) |
| [ZN-0006](../tickets/zn-0006.md) | Protect secrets, artifacts and merge policy | component | [ZN-0005](../tickets/zn-0005.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `repository-and-modules.md`, `technology-stack.md`, `testing-and-ci.md`. Read a named historical reference only when needed; it cannot override current contracts.
